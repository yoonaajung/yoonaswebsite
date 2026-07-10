import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  fetchProducts,
  fetchProgress,
  fetchScores,
  submitCheckin,
  submitFaceoffVote,
  submitOnboarding,
  submitRating,
} from "./src/api";
import type { FaceoffCriterion, Product, ProgressPayload, Score } from "./src/types";

type SetupStep = "profile" | "permissions" | "scan" | "connect";
type MainTab = "dashboard" | "faceoff" | "checkin";
type RatingDraft = { efficacy: number; preference: number; irritation: number };
type CheckinDraft = {
  acneScore: number;
  rednessScore: number;
  irritationScore: number;
  oilinessScore: number;
  drynessScore: number;
};

const concernsList = ["acne", "redness", "pigmentation", "aging", "dryness", "oiliness"];
const criteria: FaceoffCriterion[] = [
  "overall",
  "efficacy_acne",
  "efficacy_irritation",
  "preference_texture",
];

const defaultApiBaseUrl =
  Platform.OS === "android" ? "http://10.0.2.2:3001" : "http://127.0.0.1:3001";

export default function App() {
  const [step, setStep] = useState<SetupStep>("profile");
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [tab, setTab] = useState<MainTab>("dashboard");
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [healthEnabled, setHealthEnabled] = useState(false);
  const [shoppingEnabled, setShoppingEnabled] = useState(false);
  const [cycleTrackingEnabled, setCycleTrackingEnabled] = useState(false);
  const [routineComplexity, setRoutineComplexity] = useState<"none" | "basic" | "advanced">(
    "basic",
  );
  const [sensitivity, setSensitivity] = useState<"low" | "medium" | "high">("medium");
  const [goals, setGoals] = useState("");
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>(["acne"]);
  const [baselineCaptured, setBaselineCaptured] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState(defaultApiBaseUrl);
  const [userId, setUserId] = useState("demo-user");
  const [products, setProducts] = useState<Product[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [progress, setProgress] = useState<ProgressPayload | null>(null);
  const [ratingDrafts, setRatingDrafts] = useState<Record<string, RatingDraft>>({});
  const [criterion, setCriterion] = useState<FaceoffCriterion>("overall");
  const [certainty, setCertainty] = useState(3);
  const [pairCursor, setPairCursor] = useState(0);
  const [checkinDraft, setCheckinDraft] = useState<CheckinDraft>({
    acneScore: 4,
    rednessScore: 4,
    irritationScore: 3,
    oilinessScore: 5,
    drynessScore: 3,
  });
  const [isBusy, setIsBusy] = useState(false);
  const [errorText, setErrorText] = useState("");
  const cameraRef = useRef<CameraView | null>(null);

  const completedSetupPercent = useMemo(() => {
    let score = 0;
    if (selectedConcerns.length > 0) score += 20;
    if (cameraPermission?.granted) score += 20;
    if (locationEnabled) score += 20;
    if (baselineCaptured) score += 20;
    if (shoppingEnabled || healthEnabled) score += 20;
    return score;
  }, [
    baselineCaptured,
    cameraPermission?.granted,
    healthEnabled,
    locationEnabled,
    selectedConcerns.length,
    shoppingEnabled,
  ]);

  const currentFaceoffPair = useMemo(() => {
    if (products.length < 2) return null;
    const left = products[pairCursor % products.length];
    const right = products[(pairCursor + 1) % products.length];
    return { left, right };
  }, [pairCursor, products]);

  const toggleConcern = (concern: string) => {
    setSelectedConcerns((current) =>
      current.includes(concern)
        ? current.filter((item) => item !== concern)
        : [...current, concern],
    );
  };

  const requestLocationPermission = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    setLocationEnabled(permission.granted);
  };

  const captureBaseline = async () => {
    if (!cameraPermission?.granted || !cameraRef.current) {
      setBaselineCaptured(true);
      setStep("connect");
      return;
    }
    try {
      await cameraRef.current.takePictureAsync({ quality: 0.4, skipProcessing: true });
      setBaselineCaptured(true);
      setStep("connect");
    } catch {
      setBaselineCaptured(true);
      setStep("connect");
    }
  };

  const refreshAppData = async () => {
    const [nextProducts, nextScores, nextProgress] = await Promise.all([
      fetchProducts(apiBaseUrl),
      fetchScores(apiBaseUrl, userId),
      fetchProgress(apiBaseUrl, userId),
    ]);
    setProducts(nextProducts);
    setScores(nextScores);
    setProgress(nextProgress);
  };

  const finishOnboarding = async () => {
    setIsBusy(true);
    setErrorText("");
    try {
      await submitOnboarding(apiBaseUrl, {
        userId,
        concerns: selectedConcerns.length > 0 ? selectedConcerns : ["acne"],
        sensitivityLevel: sensitivity,
        routineComplexity,
        permissions: {
          locationEnabled,
          healthEnabled,
          shoppingEnabled,
          cycleTrackingEnabled,
        },
      });
      await refreshAppData();
      setIsOnboarded(true);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Unable to finish onboarding.");
    } finally {
      setIsBusy(false);
    }
  };

  const saveRating = async (productId: string) => {
    const draft = ratingDrafts[productId] ?? { efficacy: 3, preference: 3, irritation: 2 };
    setIsBusy(true);
    setErrorText("");
    try {
      await submitRating(apiBaseUrl, { userId, productId, ...draft });
      await refreshAppData();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to save rating.");
    } finally {
      setIsBusy(false);
    }
  };

  const voteFaceoff = async (winnerProductId: string) => {
    if (!currentFaceoffPair) return;
    setIsBusy(true);
    setErrorText("");
    try {
      await submitFaceoffVote(apiBaseUrl, {
        userId,
        productAId: currentFaceoffPair.left.id,
        productBId: currentFaceoffPair.right.id,
        winnerProductId,
        criterion,
        certainty,
      });
      setPairCursor((value) => value + 1);
      await refreshAppData();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to save face-off vote.");
    } finally {
      setIsBusy(false);
    }
  };

  const saveCheckin = async () => {
    setIsBusy(true);
    setErrorText("");
    try {
      await submitCheckin(apiBaseUrl, { userId, ...checkinDraft });
      await refreshAppData();
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to save check-in.");
    } finally {
      setIsBusy(false);
    }
  };

  const updateRating = (
    productId: string,
    key: keyof RatingDraft,
    value: number,
    bounds: { min: number; max: number },
  ) => {
    setRatingDrafts((current) => {
      const existing = current[productId] ?? { efficacy: 3, preference: 3, irritation: 2 };
      return {
        ...current,
        [productId]: {
          ...existing,
          [key]: Math.max(bounds.min, Math.min(bounds.max, value)),
        },
      };
    });
  };

  const updateCheckin = (key: keyof CheckinDraft, value: number) => {
    setCheckinDraft((current) => ({
      ...current,
      [key]: Math.max(0, Math.min(10, value)),
    }));
  };

  const renderOnboarding = () => {
    if (step === "profile") {
      return (
        <View style={styles.card}>
          <Text style={styles.title}>Build your Day 0 skin baseline</Text>
          <Text style={styles.subtitle}>
            We&apos;ll ask quick questions, scan your skin, then open your Face-Off and streak
            dashboard.
          </Text>
          <Text style={styles.label}>API base URL</Text>
          <TextInput style={styles.input} value={apiBaseUrl} onChangeText={setApiBaseUrl} />
          <Text style={styles.label}>User ID</Text>
          <TextInput style={styles.input} value={userId} onChangeText={setUserId} />
          <Text style={styles.label}>Top skin goals</Text>
          <TextInput
            style={styles.input}
            value={goals}
            placeholder="Example: Reduce acne and irritation"
            placeholderTextColor="#8fa2cf"
            onChangeText={setGoals}
          />
          <Text style={styles.label}>Main concerns</Text>
          <View style={styles.chipRow}>
            {concernsList.map((concern) => (
              <Pressable
                key={concern}
                style={[
                  styles.chip,
                  selectedConcerns.includes(concern) && styles.chipActive,
                ]}
                onPress={() => toggleConcern(concern)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedConcerns.includes(concern) && styles.chipTextActive,
                  ]}
                >
                  {concern}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Sensitivity</Text>
          <View style={styles.row}>
            {(["low", "medium", "high"] as const).map((level) => (
              <PillButton
                key={level}
                label={level}
                active={sensitivity === level}
                onPress={() => setSensitivity(level)}
              />
            ))}
          </View>
          <Text style={styles.label}>Routine complexity</Text>
          <View style={styles.row}>
            {(["none", "basic", "advanced"] as const).map((level) => (
              <PillButton
                key={level}
                label={level}
                active={routineComplexity === level}
                onPress={() => setRoutineComplexity(level)}
              />
            ))}
          </View>
          <Pressable style={styles.primaryButton} onPress={() => setStep("permissions")}>
            <Text style={styles.primaryButtonText}>Continue</Text>
          </Pressable>
        </View>
      );
    }

    if (step === "permissions") {
      return (
        <View style={styles.card}>
          <Text style={styles.title}>Enable smart context</Text>
          <PermissionRow
            emoji="📷"
            title="Camera access"
            description="Required for baseline and progress scan capture."
            value={Boolean(cameraPermission?.granted)}
            onPress={requestCameraPermission}
          />
          <PermissionRow
            emoji="📍"
            title="Location access"
            description="Uses UV and humidity to contextualize product outcomes."
            value={locationEnabled}
            onPress={requestLocationPermission}
          />
          <ToggleRow
            emoji="🩺"
            title="Health app connection"
            description="Brings in sleep and activity context."
            value={healthEnabled}
            onChange={setHealthEnabled}
          />
          <ToggleRow
            emoji="🛒"
            title="Shopping history"
            description="Import products from receipts and storefronts."
            value={shoppingEnabled}
            onChange={setShoppingEnabled}
          />
          <ToggleRow
            emoji="🧬"
            title="Cycle tracking"
            description="Adds monthly biological context."
            value={cycleTrackingEnabled}
            onChange={setCycleTrackingEnabled}
          />
          <Pressable style={styles.primaryButton} onPress={() => setStep("scan")}>
            <Text style={styles.primaryButtonText}>Start baseline scan</Text>
          </Pressable>
        </View>
      );
    }

    if (step === "scan") {
      return (
        <View style={styles.card}>
          <Text style={styles.title}>Day 0 camera scan</Text>
          <Text style={styles.subtitle}>
            Capture this once now. Future scans compare against your baseline.
          </Text>
          <View style={styles.cameraFrame}>
            {cameraPermission?.granted ? (
              <CameraView ref={cameraRef} style={styles.camera} facing="front" />
            ) : (
              <View style={styles.cameraFallback}>
                <Text style={styles.cameraFallbackText}>
                  Camera permission is off. You can continue and scan later.
                </Text>
              </View>
            )}
          </View>
          <Pressable style={styles.primaryButton} onPress={captureBaseline}>
            <Text style={styles.primaryButtonText}>
              {cameraPermission?.granted ? "Capture baseline" : "Skip for now"}
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.card}>
        <Text style={styles.title}>Connect product sources</Text>
        <Text style={styles.subtitle}>
          Connect now, then rate products and run face-offs to unlock precise compatibility scores.
        </Text>
        <View style={styles.listItem}>
          <Text style={styles.listTitle}>Email receipts</Text>
          <Text style={styles.listSubtitle}>Import skincare purchase history</Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.listTitle}>Shopify storefronts</Text>
          <Text style={styles.listSubtitle}>Connect checkout history</Text>
        </View>
        <View style={styles.listItem}>
          <Text style={styles.listTitle}>Manual product entry</Text>
          <Text style={styles.listSubtitle}>Add product + ingredient list quickly</Text>
        </View>
        <Pressable style={styles.primaryButton} onPress={finishOnboarding}>
          <Text style={styles.primaryButtonText}>Finish setup and open app</Text>
        </Pressable>
      </View>
    );
  };

  const renderDashboard = () => (
    <View style={styles.card}>
      <Text style={styles.title}>Progress dashboard</Text>
      <Text style={styles.subtitle}>
        Track streaks, unlock progress, and compatibility outcomes in one place.
      </Text>
      <View style={styles.progressCard}>
        <Text style={styles.progressLabel}>Onboarding completeness</Text>
        <Text style={styles.progressValue}>{completedSetupPercent}%</Text>
      </View>
      <View style={styles.progressCard}>
        <Text style={styles.progressLabel}>Active routine streak</Text>
        <Text style={styles.progressValue}>{progress?.activeStreakDays ?? 0} days</Text>
      </View>
      <View style={styles.progressCard}>
        <Text style={styles.progressLabel}>Unlock compatibility</Text>
        <Text style={styles.progressSmall}>
          Ratings: {progress?.unlockProgress.ratings ?? 0}/
          {progress?.unlockRequirements.ratingsRequired ?? 5}
        </Text>
        <Text style={styles.progressSmall}>
          Face-offs: {progress?.unlockProgress.faceoffs ?? 0}/
          {progress?.unlockRequirements.faceoffsRequired ?? 12}
        </Text>
        <Text style={styles.progressSmall}>
          Tracked days: {progress?.unlockProgress.trackingDays ?? 0}/
          {progress?.unlockRequirements.trackingDaysRequired ?? 14}
        </Text>
      </View>
      <Text style={styles.sectionTitle}>Rate products (1-5)</Text>
      {products.map((product) => {
        const draft = ratingDrafts[product.id] ?? {
          efficacy: 3,
          preference: 3,
          irritation: 2,
        };
        const score = scores.find((entry) => entry.productId === product.id);
        return (
          <View key={product.id} style={styles.listItem}>
            <Text style={styles.listTitle}>
              {product.brand} {product.name}
            </Text>
            <Text style={styles.listSubtitle}>
              Compatibility: {Math.round(score?.compatibilityScore ?? 0)}
              /100 • Confidence: {Math.round(score?.confidenceScore ?? 0)}
            </Text>
            <Stepper
              label="Efficacy"
              value={draft.efficacy}
              min={1}
              max={5}
              onChange={(value) => updateRating(product.id, "efficacy", value, { min: 1, max: 5 })}
            />
            <Stepper
              label="Preference"
              value={draft.preference}
              min={1}
              max={5}
              onChange={(value) =>
                updateRating(product.id, "preference", value, { min: 1, max: 5 })
              }
            />
            <Stepper
              label="Irritation"
              value={draft.irritation}
              min={1}
              max={5}
              onChange={(value) =>
                updateRating(product.id, "irritation", value, { min: 1, max: 5 })
              }
            />
            <Pressable style={styles.secondaryButton} onPress={() => saveRating(product.id)}>
              <Text style={styles.secondaryButtonText}>Save rating</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );

  const renderFaceoff = () => (
    <View style={styles.card}>
      <Text style={styles.title}>Face-Off comparisons</Text>
      <Text style={styles.subtitle}>
        Compare product pairs like Beli to build your personalized efficacy graph.
      </Text>
      <Text style={styles.label}>Criterion</Text>
      <View style={styles.chipRow}>
        {criteria.map((entry) => (
          <Pressable
            key={entry}
            style={[styles.chip, criterion === entry && styles.chipActive]}
            onPress={() => setCriterion(entry)}
          >
            <Text style={[styles.chipText, criterion === entry && styles.chipTextActive]}>
              {entry.replaceAll("_", " ")}
            </Text>
          </Pressable>
        ))}
      </View>
      <Stepper
        label="How sure are you?"
        value={certainty}
        min={1}
        max={5}
        onChange={setCertainty}
      />
      {currentFaceoffPair ? (
        <View style={styles.faceoffWrap}>
          <Pressable
            style={styles.faceoffCard}
            onPress={() => voteFaceoff(currentFaceoffPair.left.id)}
          >
            <Text style={styles.faceoffBrand}>{currentFaceoffPair.left.brand}</Text>
            <Text style={styles.faceoffName}>{currentFaceoffPair.left.name}</Text>
            <Text style={styles.faceoffHint}>Tap if better</Text>
          </Pressable>
          <Text style={styles.vsText}>VS</Text>
          <Pressable
            style={styles.faceoffCard}
            onPress={() => voteFaceoff(currentFaceoffPair.right.id)}
          >
            <Text style={styles.faceoffBrand}>{currentFaceoffPair.right.brand}</Text>
            <Text style={styles.faceoffName}>{currentFaceoffPair.right.name}</Text>
            <Text style={styles.faceoffHint}>Tap if better</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.subtitle}>Need at least two products to start face-offs.</Text>
      )}
    </View>
  );

  const renderCheckin = () => (
    <View style={styles.card}>
      <Text style={styles.title}>Daily check-in</Text>
      <Text style={styles.subtitle}>
        Submit quick skin signals to track streaks and unlock high-confidence compatibility.
      </Text>
      <Stepper
        label="Acne intensity (0-10)"
        value={checkinDraft.acneScore}
        min={0}
        max={10}
        onChange={(value) => updateCheckin("acneScore", value)}
      />
      <Stepper
        label="Redness (0-10)"
        value={checkinDraft.rednessScore}
        min={0}
        max={10}
        onChange={(value) => updateCheckin("rednessScore", value)}
      />
      <Stepper
        label="Irritation (0-10)"
        value={checkinDraft.irritationScore}
        min={0}
        max={10}
        onChange={(value) => updateCheckin("irritationScore", value)}
      />
      <Stepper
        label="Oiliness (0-10)"
        value={checkinDraft.oilinessScore}
        min={0}
        max={10}
        onChange={(value) => updateCheckin("oilinessScore", value)}
      />
      <Stepper
        label="Dryness (0-10)"
        value={checkinDraft.drynessScore}
        min={0}
        max={10}
        onChange={(value) => updateCheckin("drynessScore", value)}
      />
      <Pressable style={styles.primaryButton} onPress={saveCheckin}>
        <Text style={styles.primaryButtonText}>Save check-in</Text>
      </Pressable>
      <Text style={styles.footerNote}>
        Current streak: {progress?.activeStreakDays ?? 0} day(s) • Total check-ins:{" "}
        {progress?.checkinCount ?? 0}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        {!isOnboarded ? (
          renderOnboarding()
        ) : (
          <View style={styles.card}>
            <View style={styles.tabRow}>
              <TabButton label="Dashboard" active={tab === "dashboard"} onPress={() => setTab("dashboard")} />
              <TabButton label="Face-Off" active={tab === "faceoff"} onPress={() => setTab("faceoff")} />
              <TabButton label="Check-in" active={tab === "checkin"} onPress={() => setTab("checkin")} />
            </View>
            {tab === "dashboard" && renderDashboard()}
            {tab === "faceoff" && renderFaceoff()}
            {tab === "checkin" && renderCheckin()}
          </View>
        )}
        {isBusy ? <ActivityIndicator color="#8aa2ff" size="large" style={styles.loading} /> : null}
        {errorText ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorText}</Text>
          </View>
        ) : null}
        {isOnboarded ? (
          <Pressable style={styles.secondaryButton} onPress={refreshAppData}>
            <Text style={styles.secondaryButtonText}>Refresh from API</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function PermissionRow({
  emoji,
  title,
  description,
  value,
  onPress,
}: {
  emoji: string;
  title: string;
  description: string;
  value: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleTextWrap}>
        <Text style={styles.toggleTitle}>
          {emoji} {title}
        </Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <Pressable style={[styles.tag, value && styles.tagEnabled]} onPress={onPress}>
        <Text style={styles.tagText}>{value ? "Enabled" : "Enable"}</Text>
      </Pressable>
    </View>
  );
}

function ToggleRow({
  emoji,
  title,
  description,
  value,
  onChange,
}: {
  emoji: string;
  title: string;
  description: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleTextWrap}>
        <Text style={styles.toggleTitle}>
          {emoji} {title}
        </Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

function PillButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.pill, active && styles.pillActive]} onPress={onPress}>
      <Text style={styles.pillText}>{label}</Text>
    </Pressable>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.row}>
        <Pressable style={styles.stepperButton} onPress={() => onChange(Math.max(min, value - 1))}>
          <Text style={styles.stepperButtonText}>-</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable style={styles.stepperButton} onPress={() => onChange(Math.min(max, value + 1))}>
          <Text style={styles.stepperButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
      <Text style={styles.tabButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0b1020" },
  container: { padding: 16, gap: 12 },
  card: {
    backgroundColor: "#111830",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#223055",
    gap: 12,
  },
  title: { color: "#f4f8ff", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#b7c2e0", fontSize: 14, lineHeight: 20 },
  sectionTitle: { color: "#e7eeff", fontWeight: "700", marginTop: 8 },
  label: { color: "#e7eeff", fontSize: 13, fontWeight: "600" },
  input: {
    backgroundColor: "#1a2445",
    borderRadius: 12,
    color: "#f1f6ff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#30406f",
  },
  chipActive: { backgroundColor: "#3f6bff", borderColor: "#3f6bff" },
  chipText: { color: "#c3d2ff", textTransform: "capitalize", fontWeight: "600" },
  chipTextActive: { color: "white" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  tabRow: { flexDirection: "row", gap: 8 },
  tabButton: {
    flex: 1,
    backgroundColor: "#1c2a53",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  tabButtonActive: { backgroundColor: "#3f6bff" },
  tabButtonText: { color: "white", fontWeight: "700" },
  pill: {
    backgroundColor: "#1a2445",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillActive: { backgroundColor: "#2d4698" },
  pillText: { color: "#eef3ff", textTransform: "capitalize", fontWeight: "600" },
  primaryButton: {
    marginTop: 4,
    backgroundColor: "#5f7dff",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButtonText: { color: "white", fontWeight: "700" },
  secondaryButton: {
    backgroundColor: "#1f8f4f",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: "white", fontWeight: "700" },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  toggleTextWrap: { flex: 1 },
  toggleTitle: { color: "#f3f6ff", fontWeight: "700" },
  toggleDescription: { color: "#aab6da", fontSize: 12, marginTop: 3, lineHeight: 17 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#2b3558",
  },
  tagEnabled: { backgroundColor: "#1f8f4f" },
  tagText: { color: "white", fontWeight: "600", fontSize: 12 },
  cameraFrame: {
    height: 300,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#30406f",
    overflow: "hidden",
  },
  camera: { flex: 1 },
  cameraFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a2445",
    padding: 16,
  },
  cameraFallbackText: { color: "#dce6ff", textAlign: "center" },
  listItem: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#2a3c6f",
    borderRadius: 12,
    gap: 8,
  },
  listTitle: { color: "#eef3ff", fontWeight: "700" },
  listSubtitle: { color: "#aab6da", marginTop: 2 },
  progressCard: {
    backgroundColor: "#1a2445",
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  progressLabel: { color: "#d7e2ff" },
  progressValue: { color: "#ffffff", fontWeight: "800", fontSize: 20, marginTop: 3 },
  progressSmall: { color: "#d3ddfb" },
  footerNote: { color: "#b9c8f7", marginTop: 8 },
  stepperRow: { gap: 8, marginTop: 2 },
  stepperLabel: { color: "#dbe5ff", fontWeight: "600" },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#2e3e72",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonText: { color: "white", fontWeight: "800", fontSize: 18, marginTop: -2 },
  stepperValue: { color: "#ffffff", minWidth: 24, textAlign: "center", fontWeight: "700" },
  faceoffWrap: { gap: 10 },
  faceoffCard: {
    borderWidth: 1,
    borderColor: "#35509a",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#1a2445",
    gap: 4,
  },
  faceoffBrand: { color: "#9ab1f3", fontWeight: "700" },
  faceoffName: { color: "white", fontWeight: "700", fontSize: 16 },
  faceoffHint: { color: "#c7d5ff" },
  vsText: { color: "#9eb3f3", textAlign: "center", fontWeight: "800" },
  loading: { marginTop: 10 },
  errorBox: {
    borderWidth: 1,
    borderColor: "#a83e52",
    backgroundColor: "#3d1f2a",
    borderRadius: 12,
    padding: 10,
  },
  errorText: { color: "#ffd8df" },
});
