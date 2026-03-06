/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, RefreshCw, Sparkles, Image as ImageIcon, X, Info, Maximize, Minimize } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setError(null);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Camera access denied or not available.");
    }
  }, [facingMode, stream]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg');
      }
    }
    return null;
  };

  const analyzeScene = async () => {
    const imageData = captureFrame();
    if (!imageData) return;

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const base64Data = imageData.split(',')[1];
      const response = await genAI.models.generateContent({
        model: "gemini-1.5-flash-latest",
        contents: [
          {
            parts: [
              { text: "Describe this scene in a few words, focusing on the mood and main subjects. Keep it poetic and brief (max 15 words)." },
              { inlineData: { mimeType: "image/jpeg", data: base64Data } }
            ]
          }
        ]
      });

      setAnalysis(response.text || "Unable to analyze scene.");
    } catch (err) {
      console.error("Analysis error:", err);
      setAnalysis("Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const takePhoto = () => {
    const imageData = captureFrame();
    if (imageData) {
      setCapturedImage(imageData);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  return (
    <div className="relative h-screen w-screen bg-black flex flex-col items-center justify-center overflow-hidden font-sans">
      {/* Background Video Stream */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Hidden Canvas for Capturing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-10">
        <div className="flex flex-col gap-1">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-light tracking-widest uppercase flex items-center gap-2"
          >
            Lumina <span className="font-bold">Cam</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            className="text-[10px] uppercase tracking-[0.2em] font-mono"
          >
            AI Vision Enabled
          </motion.p>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={toggleFullscreen}
            className="p-3 glass rounded-full hover:bg-white/20 transition-colors"
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
          <button 
            onClick={toggleCamera}
            className="p-3 glass rounded-full hover:bg-white/20 transition-colors"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>

      {/* AI Analysis Overlay */}
      <AnimatePresence>
        {(analysis || isAnalyzing) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute top-24 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-20"
          >
            <div className="glass p-4 rounded-2xl flex items-center gap-4">
              <div className={`p-2 rounded-full ${isAnalyzing ? 'animate-pulse bg-emerald-500/20' : 'bg-white/10'}`}>
                <Sparkles size={18} className={isAnalyzing ? 'text-emerald-400' : 'text-white/60'} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-1">
                  {isAnalyzing ? 'Analyzing Scene...' : 'AI Insight'}
                </p>
                <p className="text-sm font-medium leading-relaxed italic">
                  {isAnalyzing ? 'Observing details...' : analysis}
                </p>
              </div>
              {!isAnalyzing && (
                <button onClick={() => setAnalysis(null)} className="text-white/40 hover:text-white">
                  <X size={16} />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 p-8 text-center">
          <div className="max-w-xs">
            <Info className="mx-auto mb-4 text-red-500" size={48} />
            <h2 className="text-xl font-bold mb-2">Camera Error</h2>
            <p className="text-white/60 mb-6">{error}</p>
            <button 
              onClick={startCamera}
              className="px-6 py-2 bg-white text-black rounded-full font-bold uppercase text-xs tracking-widest"
            >
              Retry Access
            </button>
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-10 flex items-center justify-around z-10 bg-gradient-to-t from-black/60 to-transparent">
        <button 
          onClick={() => {/* Gallery Placeholder */}}
          className="p-4 glass rounded-full text-white/60 hover:text-white transition-colors"
        >
          <ImageIcon size={24} />
        </button>

        <div className="flex flex-col items-center gap-4">
          <button 
            onClick={takePhoto}
            className="shutter-btn group"
          >
            <div className="shutter-inner" />
          </button>
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/40">Capture</span>
        </div>

        <button 
          onClick={analyzeScene}
          disabled={isAnalyzing}
          className={`p-4 glass rounded-full transition-all ${isAnalyzing ? 'opacity-50' : 'hover:bg-emerald-500/20 hover:text-emerald-400'}`}
        >
          <Sparkles size={24} />
        </button>
      </div>

      {/* Captured Image Preview Modal */}
      <AnimatePresence>
        {capturedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black z-[100] flex flex-col"
          >
            <div className="p-6 flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-widest">Preview</h3>
              <button 
                onClick={() => setCapturedImage(null)}
                className="p-2 glass rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
              <img 
                src={capturedImage} 
                alt="Captured" 
                className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="p-10 flex justify-center gap-6">
              <button 
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = capturedImage;
                  link.download = `lumina-${Date.now()}.jpg`;
                  link.click();
                }}
                className="px-8 py-3 glass rounded-full font-bold uppercase text-xs tracking-widest hover:bg-white hover:text-black transition-all"
              >
                Save to Device
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decorative Grid Lines */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <div className="absolute top-1/3 left-0 right-0 h-[1px] bg-white" />
        <div className="absolute top-2/3 left-0 right-0 h-[1px] bg-white" />
        <div className="absolute left-1/3 top-0 bottom-0 w-[1px] bg-white" />
        <div className="absolute left-2/3 top-0 bottom-0 w-[1px] bg-white" />
      </div>
    </div>
  );
}
