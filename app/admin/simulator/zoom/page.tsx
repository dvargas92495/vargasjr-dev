import SimulatorLayout from "@/components/SimulatorLayout";
import ZoomSimulatorClient from "@/components/ZoomSimulatorClient";

export default function ZoomSimulatorPage() {
  return (
    <SimulatorLayout
      title="Zoom Simulator"
      description="Simulate Zoom meeting bot integration"
    >
      <ZoomSimulatorClient />
    </SimulatorLayout>
  );
}
