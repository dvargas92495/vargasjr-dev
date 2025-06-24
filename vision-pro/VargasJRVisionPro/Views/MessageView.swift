import SwiftUI

struct MessageView: View {
    let message: ChatMessage
    
    var body: some View {
        HStack {
            if isFromUser {
                Spacer()
                messageContent
                    .background(.blue.opacity(0.1))
            } else {
                messageContent
                    .background(.gray.opacity(0.1))
                Spacer()
            }
        }
        .padding(.horizontal)
    }
    
    private var messageContent: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(message.body)
                .font(.body)
                .foregroundStyle(.primary)
            
            HStack {
                Text(message.source)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                
                Spacer()
                
                Text(message.createdAt, style: .time)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .frame(maxWidth: 400, alignment: isFromUser ? .trailing : .leading)
    }
    
    private var isFromUser: Bool {
        !message.source.contains("@") || message.source == "user"
    }
}

struct ChatView: View {
    let sessionId: String
    @StateObject private var viewModel = ChatViewModel()
    @State private var newMessage = ""
    
    var body: some View {
        VStack {
            if let session = viewModel.chatSession {
                headerView(session: session)
            }
            
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(viewModel.messages, id: \.id) { message in
                        MessageView(message: message)
                    }
                }
                .padding()
            }
            
            messageInputView
        }
        .navigationTitle("Chat Session")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadChatSession(sessionId: sessionId)
        }
        .refreshable {
            await viewModel.refreshSession()
        }
    }
    
    private func headerView(session: ChatSession) -> some View {
        VStack(spacing: 4) {
            Text("Chat with Vargas JR")
                .font(.headline)
            
            Text(session.contactEmail)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            
            Text("Session started: \(session.createdAt, style: .date)")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding()
        .background(.regularMaterial)
    }
    
    private var messageInputView: some View {
        HStack {
            TextField("Type your message...", text: $newMessage, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(1...4)
            
            Button("Send") {
                sendMessage()
            }
            .buttonStyle(.borderedProminent)
            .disabled(newMessage.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding()
        .background(.regularMaterial)
    }
    
    private func sendMessage() {
        let messageToSend = newMessage.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !messageToSend.isEmpty else { return }
        
        newMessage = ""
        
        Task {
            if let session = viewModel.chatSession {
                let success = await viewModel.sendContactMessage(
                    email: session.contactEmail,
                    message: messageToSend
                )
                
                if success {
                    await viewModel.refreshSession()
                }
            }
        }
    }
}

struct ChatView_Previews: PreviewProvider {
    static var previews: some View {
        ChatView(sessionId: "preview-session-id")
    }
}
