# Vargas JR Vision Pro Client

A native visionOS application that provides an immersive interface for interacting with the Vargas JR AI-powered personal assistant platform.

## Overview

This Vision Pro app allows users to:
- Start chat sessions with Vargas JR through an intuitive spatial interface
- Send messages and receive AI-powered responses
- View chat history in an immersive 3D environment
- Seamlessly integrate with the existing Vargas JR backend API

## Project Structure

```
vision-pro/
├── VargasJRVisionPro.xcodeproj/     # Xcode project file
└── VargasJRVisionPro/               # Source code
    ├── VargasJRVisionProApp.swift   # Main app entry point
    ├── ContentView.swift            # Primary user interface
    ├── Services/
    │   └── ChatService.swift        # API integration layer
    ├── ViewModels/
    │   └── ChatViewModel.swift      # Business logic and state management
    ├── Views/
    │   └── MessageView.swift        # Chat interface components
    ├── Assets.xcassets/             # App icons and assets
    ├── Info.plist                  # App configuration
    └── Preview Content/             # SwiftUI preview assets
```

## Prerequisites

### Hardware Requirements
- **Apple Vision Pro device** (for device testing)
- **Mac with Apple Silicon** (M1/M2/M3) or Intel Mac with macOS 13.0+
- **Minimum 8GB RAM** recommended for Xcode and Vision Pro Simulator

### Software Requirements
- **Xcode 15.0 or later** with visionOS SDK
- **macOS Ventura 13.0 or later**
- **Apple Developer Account** (free or paid)
- **Vision Pro Simulator** (included with Xcode)

## Getting Started

### 1. Install Xcode and visionOS SDK

1. Download Xcode 15.0+ from the Mac App Store or Apple Developer Portal
2. Launch Xcode and install additional components when prompted
3. Verify visionOS SDK installation:
   ```bash
   xcodebuild -showsdks | grep xros
   ```
   You should see output like: `xros1.0` or similar

### 2. Open the Project

1. Navigate to the `vision-pro` directory
2. Double-click `VargasJRVisionPro.xcodeproj` to open in Xcode
3. Wait for Xcode to index the project files

### 3. Configure Development Team

1. In Xcode, select the project in the navigator
2. Under "Signing & Capabilities", select your development team
3. Ensure "Automatically manage signing" is checked
4. Xcode will automatically generate a bundle identifier if needed

## Testing Instructions

### Option 1: Vision Pro Simulator (Recommended for Initial Testing)

The Vision Pro Simulator provides a convenient way to test the app without physical hardware.

#### Setup Simulator
1. In Xcode, go to **Window > Devices and Simulators**
2. Click the **Simulators** tab
3. Click **+** to add a new simulator
4. Select **Apple Vision Pro** from the device list
5. Choose the latest visionOS version
6. Name it "Vision Pro Test" and click **Create**

#### Run the App
1. In Xcode, select the Vision Pro simulator from the scheme selector
2. Press **⌘+R** or click the **Run** button
3. The simulator will launch and install the app
4. The app should open automatically in the simulated Vision Pro environment

#### Testing Features
- **Email Input**: Enter a valid email address
- **Message Input**: Type a test message like "Hello, can you help me with sports betting?"
- **Chat Session**: Tap "Start Chat Session" to create a new session
- **Navigation**: The app should navigate to the chat interface
- **API Integration**: Verify the app connects to the production API at `https://vargasjr-dev.vercel.app/api`

#### Simulator Controls
- **Look Around**: Click and drag to change your view direction
- **Select Items**: Click on UI elements to interact
- **Hand Tracking**: Use mouse movements to simulate hand gestures
- **Reset View**: Press **⌘+1** to reset to center view

### Option 2: Physical Vision Pro Device

Testing on actual hardware provides the most accurate experience.

#### Prerequisites for Device Testing
1. **Apple Developer Account**: You need a paid Apple Developer account ($99/year) for device deployment
2. **Vision Pro with visionOS 1.0+**: Ensure your device is updated
3. **Same Apple ID**: Use the same Apple ID for your developer account and Vision Pro

#### Device Setup
1. **Enable Developer Mode**:
   - On Vision Pro: Settings > Privacy & Security > Developer Mode
   - Toggle "Developer Mode" on
   - Restart the device when prompted

2. **Trust Your Mac**:
   - Connect Vision Pro to your Mac via USB-C (if available) or ensure both are on the same Wi-Fi network
   - In Xcode: Window > Devices and Simulators > Devices
   - Select your Vision Pro and click "Use for Development"
   - Enter your Apple ID credentials if prompted

#### Deploy to Device
1. In Xcode, select your Vision Pro device from the scheme selector
2. Ensure your development team is properly configured
3. Press **⌘+R** to build and run
4. Xcode will install the app on your Vision Pro
5. Put on the Vision Pro and launch the app from the Home View

#### Device Testing Features
- **Spatial Interface**: Experience the true 3D volumetric window
- **Hand Tracking**: Use natural hand gestures to interact with the UI
- **Eye Tracking**: Navigate using eye movements combined with hand gestures
- **Real Performance**: Test actual performance and responsiveness
- **Network Connectivity**: Verify API calls work over your network

### Option 3: TestFlight Distribution (For Beta Testing)

For sharing with other Vision Pro users:

#### Setup TestFlight
1. **Archive the App**:
   - In Xcode: Product > Archive
   - Wait for the build to complete
   - Click "Distribute App" in the Organizer

2. **Upload to App Store Connect**:
   - Select "App Store Connect"
   - Choose your development team
   - Upload the build

3. **Configure TestFlight**:
   - Go to App Store Connect
   - Add beta testers via email
   - Submit for beta review (usually 24-48 hours)

#### Beta Tester Instructions
1. Install TestFlight on Vision Pro from the App Store
2. Accept the beta invitation email
3. Download and install the Vargas JR app through TestFlight
4. Provide feedback through TestFlight or directly to the development team

## API Integration

The app integrates with the existing Vargas JR backend API:

### Endpoints Used
- **POST** `/api/chat` - Create new chat sessions
- **GET** `/api/chat/{id}` - Retrieve chat session details
- **POST** `/api/contact` - Send contact messages

### Configuration
The base API URL is configured in `ChatService.swift`:
```swift
private let baseURL = "https://vargasjr-dev.vercel.app/api"
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

#### "Vision Pro Simulator not available"
- Update Xcode to version 15.0 or later
- Install visionOS SDK through Xcode preferences
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

#### "Simulator performance issues"
- Close other applications to free up memory
- Reduce simulator graphics quality in preferences
- Consider testing on physical hardware for better performance

### Debug Mode

To enable additional logging:
1. In Xcode, edit the scheme (Product > Scheme > Edit Scheme)
2. Under "Run" > "Arguments", add environment variable:
   - Name: `DEBUG_LOGGING`
   - Value: `1`
3. The app will output detailed API request/response information

### Performance Optimization

For better performance:
- Test on physical hardware when possible
- Monitor memory usage in Xcode's Debug Navigator
- Use Instruments to profile the app
- Optimize image assets for visionOS

## Next Steps

### Planned Features
- **Voice Input**: Integration with Speech Recognition framework
- **Spatial Audio**: Enhanced audio feedback for responses
- **Hand Gesture Shortcuts**: Custom gestures for common actions
- **Multi-Window Support**: Multiple chat sessions in separate windows
- **Offline Mode**: Local caching for improved reliability

### Development Workflow
1. Make changes to the Swift code
2. Test in Vision Pro Simulator
3. Deploy to physical device for final validation
4. Submit updates through TestFlight for beta testing
5. Gather user feedback and iterate

## Support

For technical issues or questions:
- Check the main project README at the repository root
- Review the existing API documentation
- Test API endpoints independently to isolate issues
- Use Xcode's built-in debugging tools for app-specific problems

## Contributing

When contributing to the Vision Pro client:
1. Follow Swift coding conventions
2. Test on both simulator and device when possible
3. Ensure API integration remains compatible with the existing backend
4. Update this README with any new setup requirements or features
