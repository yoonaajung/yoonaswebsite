import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useMemo, useRef, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

type SetupStep = "profile" | "permissions" | "scan" | "connect" | "done";

const concernsList = ["acne", "redness", "pigmentation", "aging", "dryness", "oiliness"];

export default function App() {
  const [step, setStep] = useState<SetupStep>("profile");
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
  const cameraRef = useRef<CameraView | null>(null);

  const completedSetupPercent = useMemo(() => {
    let score = 0;
    if (selectedConcerns.length > 0) score += 20;
    if (cameraPermission?.granted) score += 20;
    if (locationEnabled) score += 20;
    if (baselineCaptured) score += 20;
    if (shoppingEnabled || healthEnabled) score += 20;
    return score;
  }, [baselineCaptured, cameraPermission?.granted, healthEnabled, locationEnabled, selectedConcerns.length, shoppingEnabled]);

  const toggleConcern = (concern: string) => {
    setSelectedConcerns((current) =>
      current.includes(concern)
        ? current.filter((item) => item !== concern)
        : [...current, concern],
    );
  };

  const requestLocationPermission = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.granted) {
      setLocationEnabled(true);
      return;
    }
    setLocationEnabled(false);
  };

  const captureBaseline = async () => {
    if (!cameraRef.current) return;
    try {
      await cameraRef.current.takePictureAsync({
        quality: 0.4,
        skipProcessing: true,
      });
      setBaselineCaptured(true);
      setStep("connect");
    } catch {
      // Camera can fail on unsupported simulators; keep flow unblocked.
      setBaselineCaptured(true);
      setStep("connect");
    }
  };

  const renderStep = () => {
    if (step === "profile") {
      return (
        <View style={styles.card}>
          <Text style={styles.title}>Build your Day 0 skin baseline</Text>
          <Text style={styles.subtitle}>
            We&apos;ll ask quick questions, scan your skin, then unlock smarter product scoring.
          </Text>
          <Text style={styles.label}>Top skin goals</Text>
          <TextInput
            style={styles.input}
            value={goals}
            placeholder="Example: Reduce acne and irritation"
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
              <Pressable
                key={level}
                style={[styles.pill, sensitivity === level && styles.pillActive]}
                onPress={() => setSensitivity(level)}
              >
                <Text style={styles.pillText}>{level}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Routine complexity</Text>
          <View style={styles.row}>
            {(["none", "basic", "advanced"] as const).map((level) => (
              <Pressable
                key={level}
                style={[styles.pill, routineComplexity === level && styles.pillActive]}
                onPress={() => setRoutineComplexity(level)}
              >
                <Text style={styles.pillText}>{level}</Text>
              </Pressable>
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
          <Text style={styles.subtitle}>
            These are optional, but they make recommendations more accurate.
          </Text>
          <PermissionRow
            emoji="📷"
            title="Camera access"
            description="Required for baseline and progress skin scans."
            value={Boolean(cameraPermission?.granted)}
            onPress={requestCameraPermission}
          />
          <PermissionRow
            emoji="📍"
            title="Location access"
            description="Uses UV/humidity to adjust product compatibility."
            value={locationEnabled}
            onPress={requestLocationPermission}
          />
          <ToggleRow
            emoji="🩺"
            title="Health app connection"
            description="Brings in sleep/activity context for breakouts and recovery."
            value={healthEnabled}
            onChange={setHealthEnabled}
          />
          <ToggleRow
            emoji="🛒"
            title="Shopping history"
            description="Auto-import skincare products from receipts and stores."
            value={shoppingEnabled}
            onChange={setShoppingEnabled}
          />
          <ToggleRow
            emoji="🧬"
            title="Cycle/hormonal tracking"
            description="Adds monthly biological context to scoring."
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
            Keep your face centered and use even lighting for reliable progress tracking.
          </Text>
          <View style={styles.cameraFrame}>
            {cameraPermission?.granted ? (
              <CameraView ref={cameraRef} style={styles.camera} facing="front" />
            ) : (
              <View style={styles.cameraFallback}>
                <Text style={styles.cameraFallbackText}>
                  Camera permission is off. You can still continue and scan later.
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

    if (step === "connect") {
      return (
        <View style={styles.card}>
          <Text style={styles.title}>Connect product sources</Text>
          <Text style={styles.subtitle}>
            Bring your products in now, then we unlock detailed compatibility after enough ratings.
          </Text>
          <View style={styles.listItem}>
            <Text style={styles.listTitle}>Email receipts</Text>
            <Text style={styles.listSubtitle}>Import product names from purchase confirmations</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listTitle}>Shopify storefronts</Text>
            <Text style={styles.listSubtitle}>Connect stores for checkout history</Text>
          </View>
          <View style={styles.listItem}>
            <Text style={styles.listTitle}>Manual entry</Text>
            <Text style={styles.listSubtitle}>Add products + ingredients in under 20 seconds</Text>
          </View>
          <Pressable style={styles.primaryButton} onPress={() => setStep("done")}>
            <Text style={styles.primaryButtonText}>Finish setup</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.card}>
        <Text style={styles.title}>Setup complete 🎉</Text>
        <Text style={styles.subtitle}>
          Your compatibility score remains locked until you rate 5 products and complete enough
          face-offs.
        </Text>
        <View style={styles.progressCard}>
          <Text style={styles.progressLabel}>Onboarding completeness</Text>
          <Text style={styles.progressValue}>{completedSetupPercent}%</Text>
        </View>
        <View style={styles.progressCard}>
          <Text style={styles.progressLabel}>Compatibility unlock progress</Text>
          <Text style={styles.progressValue}>0 / 5 rated products</Text>
        </View>
        <Text style={styles.footerNote}>
          Next: add products, run your first face-off, and start your streak.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>{renderStep()}</ScrollView>
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0b1020",
  },
  container: {
    padding: 16,
    minHeight: "100%",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#111830",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#223055",
    gap: 14,
  },
  title: {
    color: "#f4f8ff",
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    color: "#b7c2e0",
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    color: "#e7eeff",
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#1a2445",
    borderRadius: 12,
    color: "#f1f6ff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#30406f",
  },
  chipActive: {
    backgroundColor: "#3f6bff",
    borderColor: "#3f6bff",
  },
  chipText: {
    color: "#c3d2ff",
    textTransform: "capitalize",
    fontWeight: "600",
  },
  chipTextActive: {
    color: "white",
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  pill: {
    backgroundColor: "#1a2445",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillActive: {
    backgroundColor: "#2d4698",
  },
  pillText: {
    color: "#eef3ff",
    textTransform: "capitalize",
    fontWeight: "600",
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: "#5f7dff",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "white",
    fontWeight: "700",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  toggleTextWrap: {
    flex: 1,
  },
  toggleTitle: {
    color: "#f3f6ff",
    fontWeight: "700",
  },
  toggleDescription: {
    color: "#aab6da",
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#2b3558",
  },
  tagEnabled: {
    backgroundColor: "#1f8f4f",
  },
  tagText: {
    color: "white",
    fontWeight: "600",
    fontSize: 12,
  },
  cameraFrame: {
    height: 350,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#30406f",
    overflow: "hidden",
  },
  camera: {
    flex: 1,
  },
  cameraFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a2445",
    padding: 16,
  },
  cameraFallbackText: {
    color: "#dce6ff",
    textAlign: "center",
  },
  listItem: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#2a3c6f",
    borderRadius: 12,
  },
  listTitle: {
    color: "#eef3ff",
    fontWeight: "700",
  },
  listSubtitle: {
    color: "#aab6da",
    marginTop: 4,
  },
  progressCard: {
    backgroundColor: "#1a2445",
    borderRadius: 12,
    padding: 12,
  },
  progressLabel: {
    color: "#d7e2ff",
  },
  progressValue: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 20,
    marginTop: 3,
  },
  footerNote: {
    color: "#b9c8f7",
    marginTop: 8,
  },
});
