import SwiftUI

struct ContentView: View {
    @StateObject private var chatViewModel = ChatViewModel()
    @State private var userEmail = ""
    @State private var messageText = ""
    @State private var showingChat = false
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    VStack(spacing: 8) {
                        Text("Vargas JR")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                            .foregroundStyle(.primary)
                        
                        Text("Your AI-Powered Personal Assistant")
                            .font(.headline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 40)
                    
                    VStack(spacing: 16) {
                        TextField("Enter your email", text: $userEmail)
                            .textFieldStyle(.roundedBorder)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                            .autocorrectionDisabled()
                        
                        TextField("How can Vargas JR help you today?", text: $messageText, axis: .vertical)
                            .textFieldStyle(.roundedBorder)
                            .lineLimit(3...6)
                        
                        Button("Start Chat Session") {
                            startChatSession()
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(userEmail.isEmpty || messageText.isEmpty || chatViewModel.isLoading)
                        .frame(maxWidth: .infinity)
                    }
                    .padding(.horizontal, 20)
                    
                    if chatViewModel.isLoading {
                        VStack(spacing: 8) {
                            ProgressView()
                                .progressViewStyle(.circular)
                            Text("Creating chat session...")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding()
                    }
                    
                    if let errorMessage = chatViewModel.errorMessage {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                            .font(.caption)
                            .padding()
                            .background(Color.red.opacity(0.1))
                            .cornerRadius(8)
                            .padding(.horizontal, 20)
                    }
                    
                    Spacer(minLength: 40)
                }
            }
            .navigationDestination(isPresented: $showingChat) {
                if let sessionId = chatViewModel.currentSessionId {
                    ChatView(sessionId: sessionId)
                }
            }
        }
    }
    
    private func startChatSession() {
        Task {
            let success = await chatViewModel.createChatSession(email: userEmail, message: messageText)
            if success {
                showingChat = true
                messageText = ""
            }
        }
    }
}

struct ChatView: View {
    let sessionId: String
    
    var body: some View {
        VStack {
            Text("Chat Session: \(sessionId)")
                .font(.headline)
                .padding()
            
            Text("Hello World! This is a simple chat interface.")
                .padding()
            
            Spacer()
            
            Text("Chat functionality coming soon...")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding()
        }
        .navigationTitle("Chat")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
