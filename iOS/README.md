# Vargas JR iOS Client

A native iOS application that provides a simple interface for interacting with the Vargas JR AI-powered personal assistant platform on iPhone.

## Overview

This iOS app allows users to:
- Start chat sessions with Vargas JR through a clean mobile interface
- Send messages and receive AI-powered responses
- View chat history optimized for iPhone screens
- Seamlessly integrate with the existing Vargas JR backend API

## Project Structure

```
iOS/
├── VargasJRiOS.xcodeproj/          # Xcode project file
└── VargasJRiOS/                    # Source code
    ├── VargasJRiOSApp.swift        # Main app entry point
    ├── ContentView.swift           # Primary user interface
    ├── Services/
    │   └── ChatService.swift       # API integration layer
    ├── ViewModels/
    │   └── ChatViewModel.swift     # Business logic and state management
    ├── Views/
    │   └── MessageView.swift       # Chat interface components
    ├── Assets.xcassets/            # App icons and assets
    ├── Info.plist                 # App configuration
    └── Preview Content/            # SwiftUI preview assets
```

## Prerequisites

### Hardware Requirements
- **iPhone device** (for device testing)
- **Mac with Xcode** (Intel or Apple Silicon)
- **Minimum 8GB RAM** recommended for Xcode and iOS Simulator

### Software Requirements
- **Xcode 15.0 or later** with iOS SDK
- **macOS Ventura 13.0 or later**
- **Apple Developer Account** (free or paid)
- **iOS Simulator** (included with Xcode)

## Getting Started

### 1. Install Xcode and iOS SDK

1. Download Xcode 15.0+ from the Mac App Store or Apple Developer Portal
2. Launch Xcode and install additional components when prompted
3. Verify iOS SDK installation:
   ```bash
   xcodebuild -showsdks | grep iphoneos
   ```

### 2. Open the Project

1. Navigate to the `iOS` directory
2. Double-click `VargasJRiOS.xcodeproj` to open in Xcode
3. Wait for Xcode to index the project files

### 3. Configure Development Team

1. In Xcode, select the project in the navigator
2. Under "Signing & Capabilities", select your development team
3. Ensure "Automatically manage signing" is checked
4. Xcode will automatically generate a bundle identifier if needed

## Testing Instructions

### Option 1: iOS Simulator (Recommended for Initial Testing)

The iOS Simulator provides a convenient way to test the app without physical hardware.

#### Setup Simulator
1. In Xcode, go to **Window > Devices and Simulators**
2. Click the **Simulators** tab
3. Click **+** to add a new simulator
4. Select **iPhone 15** or latest iPhone model from the device list
5. Choose the latest iOS version
6. Name it "iPhone Test" and click **Create**

#### Run the App
1. In Xcode, select the iPhone simulator from the scheme selector
2. Press **⌘+R** or click the **Run** button
3. The simulator will launch and install the app
4. The app should open automatically in the simulated iPhone environment

### Option 2: Physical iPhone Device

Testing on actual hardware provides the most accurate experience.

#### Prerequisites for Device Testing
1. **Apple Developer Account**: You need a free or paid Apple Developer account
2. **iPhone with iOS 15.0+**: Ensure your device is updated
3. **Same Apple ID**: Use the same Apple ID for your developer account and iPhone

#### Device Setup
1. **Enable Developer Mode**:
   - On iPhone: Settings > Privacy & Security > Developer Mode
   - Toggle "Developer Mode" on
   - Restart the device when prompted

2. **Trust Your Mac**:
   - Connect iPhone to your Mac via USB
   - In Xcode: Window > Devices and Simulators > Devices
   - Select your iPhone and click "Use for Development"
   - Enter your Apple ID credentials if prompted

#### Deploy to Device
1. In Xcode, select your iPhone device from the scheme selector
2. Ensure your development team is properly configured
3. Press **⌘+R** to build and run
4. Xcode will install the app on your iPhone
5. Launch the app from your iPhone's home screen

## API Integration

The app integrates with the existing Vargas JR backend API:

### Endpoints Used
- **POST** `/api/chat` - Create new chat sessions
- **GET** `/api/chat/{id}` - Retrieve chat session details
- **POST** `/api/contact` - Send contact messages

### Configuration
The base API URL is configured in `ChatService.swift`:
```swift
private let baseURL = "https://vargasjr.dev/api"
```

For local development, you can change this to:
```swift
private let baseURL = "http://localhost:3000/api"
```

## Troubleshooting

### Common Issues

#### "No matching provisioning profiles found"
- Ensure you have a valid Apple Developer account
- Check that your bundle identifier is unique
- Verify your development team is selected in project settings

#### "iOS Simulator not available"
- Update Xcode to version 15.0 or later
- Install iOS SDK through Xcode preferences
- Restart Xcode after installation

#### "App crashes on launch"
- Check the Xcode console for error messages
- Verify all required frameworks are linked
- Ensure the Info.plist is properly configured

#### "API calls failing"
- Check network connectivity
- Verify the API base URL is correct
- Test API endpoints using curl or Postman
- Check for CORS issues if testing locally

## Contributing

When contributing to the iOS client:
1. Follow Swift coding conventions
2. Test on both simulator and device when possible
3. Ensure API integration remains compatible with the existing backend
4. Update this README with any new setup requirements or features
