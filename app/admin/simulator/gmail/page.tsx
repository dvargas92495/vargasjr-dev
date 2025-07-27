import SimulatorLayout from "@/components/SimulatorLayout";
import GmailSimulatorClient from "@/components/GmailSimulatorClient";

export default function GmailSimulatorPage() {
  return (
    <SimulatorLayout 
      title="Gmail Simulator" 
      description="Simulate Gmail integration preview environment"
    >
      <GmailSimulatorClient />
    </SimulatorLayout>
  );
}
