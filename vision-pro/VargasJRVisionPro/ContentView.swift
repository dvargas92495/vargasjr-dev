import SwiftUI

struct ContentView: View {
    @StateObject private var chatViewModel = ChatViewModel()
    @State private var userEmail = ""
    @State private var messageText = ""
    @State private var showingChat = false
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 30) {
                Text("Vargas JR")
                    .font(.extraLargeTitle)
                    .fontWeight(.bold)
                    .foregroundStyle(.primary)
                
                Text("Your AI-Powered Personal Assistant")
                    .font(.title2)
                    .foregroundStyle(.secondary)
                
                VStack(spacing: 20) {
                    TextField("Enter your email", text: $userEmail)
                        .textFieldStyle(.roundedBorder)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                    
                    TextField("How can Vargas JR help you today?", text: $messageText, axis: .vertical)
                        .textFieldStyle(.roundedBorder)
                        .lineLimit(3...6)
                    
                    Button("Start Chat Session") {
                        startChatSession()
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(userEmail.isEmpty || messageText.isEmpty || chatViewModel.isLoading)
                }
                .padding(.horizontal, 40)
                
                if chatViewModel.isLoading {
                    ProgressView("Creating chat session...")
                        .progressViewStyle(.circular)
                }
                
                if let errorMessage = chatViewModel.errorMessage {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                        .padding()
                }
            }
            .padding(50)
            .navigationDestination(isPresented: $showingChat) {
                if let sessionId = chatViewModel.currentSessionId {
                    ChatView(sessionId: sessionId)
                }
            }
        }
        .frame(minWidth: 600, minHeight: 400)
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

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
