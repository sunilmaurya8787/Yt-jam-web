package com.example.data.model

data class ActiveRoom(
    val roomCode: String = "",
    val joinedAt: Long = 0L
)

data class UserProfile(
    val name: String = "",
    val username: String = "",
    val email: String = "",
    val createdAt: Long = 0L,
    val activeRoom: ActiveRoom? = null,
    val hostedRoomCode: String = "",
    val createdRooms: Map<String, Boolean> = emptyMap()
)

data class User(
    val uid: String = "",
    val email: String = "",
    val displayName: String = "",
    val username: String = ""
)

data class RoomMeta(
    val hostUid: String = "",
    val hostUsername: String = "",
    val createdAt: Long = 0L,
    val name: String = "",
    val description: String = "",
    val allowMembersToAddVideos: Boolean = false,
    val maxMembers: Int = 20,
    val expiresAt: Long = 0L
)

data class MemberPermissions(
    val editOrder: Boolean = false,
    val removeVideo: Boolean = false,
    val addVideo: Boolean = false,
    val changeVideo: Boolean = false
)

data class RoomMember(
    val name: String = "",
    val username: String = "",
    val isHost: Boolean = false,
    val joinedAt: Long = 0L,
    val permissions: MemberPermissions = MemberPermissions(),
    val isOnline: Boolean = false,
    val lastSeen: Long = 0L
)

data class Room(
    val roomId: String = "",
    val name: String = "",
    val hostUid: String = "",
    val currentVideoId: String = "",
    val currentPlaybackPosition: Long = 0L,
    val isPlaying: Boolean = false
)

data class PlaylistItem(
    val id: String = "",
    val videoId: String = "",
    val title: String = "",
    val thumbnailUrl: String = "",
    val addedByUid: String = "",
    val addedByUsername: String = "",
    val addedAt: Long = 0L,
    val order: Int = 0
)

data class ChatMessage(
    val messageId: String = "",
    val uid: String = "",
    val username: String = "",
    val senderUid: String = "",
    val senderName: String = "",
    val message: String = "",
    val timestamp: Long = 0L
) {
    val displayUid: String get() = uid.ifBlank { senderUid }
    val displayUsername: String get() = username.ifBlank { senderName.ifBlank { "User" } }
}

data class PlayerState(
    val currentVideoId: String = "",
    val currentVideoTitle: String = "",
    val isPlaying: Boolean = false,
    val positionSeconds: Float = 0f,
    val durationSeconds: Float = 0f,
    val updatedAt: Long = 0L,
    val updatedBy: String = ""
)
