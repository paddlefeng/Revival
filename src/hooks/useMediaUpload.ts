import { useState, useRef, ChangeEvent } from "react";

type MediaMode = "image" | "video";

export function useMediaUpload() {
  const [mode, setMode] = useState<MediaMode>("image");
  const [image, setImage] = useState(
    "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=1600&auto=format&fit=crop"
  );
  const [video, setVideo] = useState(
    "https://www.w3schools.com/html/mov_bbb.mp4"
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (file.type.startsWith("video")) {
        setVideo(reader.result as string);
        setMode("video");
      } else {
        setImage(reader.result as string);
        setMode("image");
      }
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return {
    mode,
    setMode,
    image,
    setImage,
    video,
    setVideo,
    fileInputRef,
    handleUpload,
    triggerFileInput,
  };
}