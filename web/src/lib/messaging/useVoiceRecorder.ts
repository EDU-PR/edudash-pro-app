import { useCallback, useRef, useState } from 'react';

interface UseVoiceRecorderOptions {
  onRecordingComplete: (blob: Blob, durationMs: number) => Promise<void> | void;
}

export const useVoiceRecorder = ({ onRecordingComplete }: UseVoiceRecorderOptions) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recorderError, setRecorderError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number | null>(null);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setRecorderError('Microphone is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        console.error('Voice recorder error', event);
        setRecorderError('Recording failed. Please try again.');
        stopRecording();
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        const durationMs = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());

        try {
          await onRecordingComplete(blob, durationMs);
        } catch (err) {
          console.error('Failed to handle recorded audio', err);
        }
      };

      recorder.start();
      setRecorderError(null);
      setIsRecording(true);
    } catch (error: any) {
      console.error('Unable to access microphone', error);
      setRecorderError(error?.message || 'Unable to access microphone.');
      setIsRecording(false);
    }
  }, [isRecording, onRecordingComplete, stopRecording]);

  return {
    isRecording,
    toggleRecording,
    recorderError,
  };
};
