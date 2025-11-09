import Link from "next/link";

export default function SimulatorPage() {
  const apps = [
    {
      name: "Slack",
      href: "/admin/simulator/slack",
      icon: "💬",
      bgColor: "bg-purple-500",
      description: "Team communication",
    },
    {
      name: "Gmail",
      href: "/admin/simulator/gmail",
      icon: "📧",
      bgColor: "bg-red-500",
      description: "Email management",
    },
    {
      name: "Twitter",
      href: "/admin/simulator/twitter",
      icon: "🐦",
      bgColor: "bg-blue-500",
      description: "Social media",
    },
    {
      name: "Recall",
      href: "/admin/simulator/recall",
      icon: "📹",
      bgColor: "bg-blue-600",
      description: "Meeting bot integration",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">App Simulator</h1>
        <p className="text-sm text-gray-700">
          Simulate preview environments for different applications
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl">
        {apps.map((app) => (
          <Link
            key={app.name}
            href={app.href}
            className="group block bg-white border border-gray-300 rounded-lg p-6 hover:shadow-lg hover:border-gray-400 transition-all duration-200"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div
                className={`w-16 h-16 ${app.bgColor} rounded-2xl flex items-center justify-center text-2xl shadow-md group-hover:scale-105 transition-transform duration-200`}
              >
                {app.icon}
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 text-lg">
                  {app.name}
                </h3>
                <p className="text-sm text-gray-700 mt-1">{app.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
