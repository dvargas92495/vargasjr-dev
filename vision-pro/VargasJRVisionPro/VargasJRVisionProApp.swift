import SwiftUI

@main
struct VargasJRVisionProApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .windowStyle(.volumetric)
        .defaultSize(width: 800, height: 600, depth: 400, in: .points)
    }
}
