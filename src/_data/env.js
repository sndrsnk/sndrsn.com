export default {
	ephemeralAudioApiUrl: process.env.EPHEMERAL_AUDIO_API_URL || 'https://ephemeral-audio.api.sndrsn.com',
	enableEphemeralAudio: process.env.ENABLE_EPHEMERAL_AUDIO !== 'false'
};
