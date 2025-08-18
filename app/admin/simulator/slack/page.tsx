import SimulatorLayout from "@/components/SimulatorLayout";
import SlackSimulatorClient from "@/components/SlackSimulatorClient";

export default function SlackSimulatorPage() {
  return (
    <SimulatorLayout
      title="Slack Simulator"
      description="Simulate Slack workspace preview environment"
    >
      <SlackSimulatorClient />
    </SimulatorLayout>
  );
}
