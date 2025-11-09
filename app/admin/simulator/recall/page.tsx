import SimulatorLayout from "@/components/SimulatorLayout";
import RecallSimulatorClient from "@/components/RecallSimulatorClient";

export default function RecallSimulatorPage() {
  return (
    <SimulatorLayout
      title="Recall Simulator"
      description="Simulate Recall meeting bot integration"
    >
      <RecallSimulatorClient />
    </SimulatorLayout>
  );
}
