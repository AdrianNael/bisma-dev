import React, { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

interface SignaturePadProps {
  value?: string;
  onSave: (dataUrl: string) => void;
  onClear?: () => void;
  readOnly?: boolean;
  showSave?: boolean;
  showClear?: boolean;
  showUpload?: boolean;
  width?: number;
  height?: number;
}

const SignaturePad: React.FC<SignaturePadProps> = ({
  value,
  onSave,
  onClear,
  readOnly = false,
  showSave = true,
  showClear = true,
  showUpload = true,
  width = 350,
  height = 150,
}) => {
  const sigRef = useRef<SignatureCanvas>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoadedFromValue, setIsLoadedFromValue] = useState(false);

  // Helper function to compress image before processing
  const compressImage = (
    img: HTMLImageElement,
    maxWidth: number = 800,
    maxHeight: number = 600,
    quality: number = 0.8,
  ): string => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    // Calculate new dimensions
    let { width: newWidth, height: newHeight } = img;

    if (newWidth > maxWidth) {
      newHeight = (newHeight * maxWidth) / newWidth;
      newWidth = maxWidth;
    }

    if (newHeight > maxHeight) {
      newWidth = (newWidth * maxHeight) / newHeight;
      newHeight = maxHeight;
    }

    canvas.width = newWidth;
    canvas.height = newHeight;

    // Draw and compress
    ctx.drawImage(img, 0, 0, newWidth, newHeight);
    return canvas.toDataURL("image/jpeg", quality);
  };

  useEffect(() => {
    const sig = sigRef.current;
    if (!sig) return;
    try {
      if (value) {
        sig.clear();
        sig.fromDataURL(value);
        setIsLoadedFromValue(true);
      } else {
        sig.clear();
        setIsLoadedFromValue(false);
      }
    } catch {}
  }, [value]);

  const handleSave = () => {
    if (!sigRef.current) {
      alert("SignaturePad error: signature reference not available");
      return;
    }
    // Get trimmed canvas (preferred) or full canvas
    let sourceCanvas: HTMLCanvasElement | null = null;
    try {
      const trimmedCanvasFn = sigRef.current.getTrimmedCanvas;
      if (typeof trimmedCanvasFn === "function") {
        const trimmed = trimmedCanvasFn.call(
          sigRef.current,
        ) as HTMLCanvasElement;
        if (trimmed) sourceCanvas = trimmed;
      }
    } catch (e) {}

    if (!sourceCanvas) {
      try {
        const canvasFn = sigRef.current.getCanvas;
        if (typeof canvasFn === "function") {
          const canvas = canvasFn.call(sigRef.current) as HTMLCanvasElement;
          if (canvas) sourceCanvas = canvas;
        }
      } catch (e) {}
    }

    if (!sourceCanvas) {
      alert("SignaturePad error: canvas method not found or not a function");
      return;
    }

    // Create an offscreen canvas to control output size and format
    const maxOutputWidth = 1200; // limit dimensions to avoid huge uploads
    const maxOutputHeight = 800;
    let outputWidth = sourceCanvas.width;
    let outputHeight = sourceCanvas.height;

    const scale = Math.min(
      1,
      maxOutputWidth / outputWidth,
      maxOutputHeight / outputHeight,
    );
    outputWidth = Math.round(outputWidth * scale);
    outputHeight = Math.round(outputHeight * scale);

    const outCanvas = document.createElement("canvas");
    outCanvas.width = outputWidth;
    outCanvas.height = outputHeight;
    const outCtx = outCanvas.getContext("2d");
    if (!outCtx) {
      alert("Failed to prepare image for saving");
      return;
    }

    // Ensure white background (avoid transparent PNGs becoming large when converted)
    outCtx.fillStyle = "#ffffff";
    outCtx.fillRect(0, 0, outCanvas.width, outCanvas.height);
    outCtx.drawImage(sourceCanvas, 0, 0, outCanvas.width, outCanvas.height);

    // Try several qualities to avoid server "request entity too large"
    const maxBytes = 700 * 1024; // 700KB target
    const qualities = [0.85, 0.7, 0.6, 0.5];
    let dataUrl = outCanvas.toDataURL("image/jpeg", qualities[0]);
    for (let i = 0; i < qualities.length && dataUrl.length > maxBytes; i++) {
      const q = qualities[i];
      dataUrl = outCanvas.toDataURL("image/jpeg", q);
      // if adequately small, break
      if (dataUrl.length <= maxBytes) break;
    }

    onSave(dataUrl);
  };

  const handleClear = () => {
    sigRef.current?.clear();
    onClear?.();
    setIsLoadedFromValue(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result && sigRef.current) {
        const img = new Image();
        img.onload = () => {
          try {
            // Compress image first to reduce data size
            const compressedDataUrl = compressImage(img);
            const compressedImg = new Image();
            compressedImg.onload = () => {
              // Get canvas context
              const canvas = sigRef.current?.getCanvas();
              if (!canvas) return;

              const ctx = canvas.getContext("2d");
              if (!ctx) return;

              // Clear canvas
              ctx.clearRect(0, 0, canvas.width, canvas.height);

              // Calculate scaling to fit image within canvas while maintaining aspect ratio
              const scaleX = canvas.width / compressedImg.width;
              const scaleY = canvas.height / compressedImg.height;
              const scale = Math.min(scaleX, scaleY, 1); // Don't upscale images

              // Calculate new dimensions
              let newWidth = compressedImg.width * scale;
              let newHeight = compressedImg.height * scale;

              // Add minimum padding for very small images (like 1x1)
              const minDisplaySize =
                Math.min(canvas.width, canvas.height) * 0.3; // 30% of canvas size
              if (newWidth < minDisplaySize && newHeight < minDisplaySize) {
                const paddingScale =
                  minDisplaySize / Math.max(newWidth, newHeight);
                newWidth *= paddingScale;
                newHeight *= paddingScale;
              }

              // Calculate position to center the image
              const x = (canvas.width - newWidth) / 2;
              const y = (canvas.height - newHeight) / 2;

              // Draw the image centered and scaled
              ctx.drawImage(compressedImg, x, y, newWidth, newHeight);

              setIsLoadedFromValue(true);
            };
            compressedImg.src = compressedDataUrl;
          } catch (error) {
            alert("Failed to load image. Please try a different image.");
          }
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!readOnly && !isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only hide if we're actually leaving the drop zone (not moving to a child element)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (readOnly) return;

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];

      // Validate file type
      if (!file.type.startsWith("image/")) {
        alert("Please drop an image file");
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("File size must be less than 5MB");
        return;
      }

      // Process the file
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result && sigRef.current) {
          const img = new Image();
          img.onload = () => {
            try {
              // Compress image first to reduce data size
              const compressedDataUrl = compressImage(img);
              const compressedImg = new Image();
              compressedImg.onload = () => {
                // Get canvas context
                const canvas = sigRef.current?.getCanvas();
                if (!canvas) return;

                const ctx = canvas.getContext("2d");
                if (!ctx) return;

                // Clear canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                // Calculate scaling to fit image within canvas while maintaining aspect ratio
                const scaleX = canvas.width / compressedImg.width;
                const scaleY = canvas.height / compressedImg.height;
                const scale = Math.min(scaleX, scaleY, 1); // Don't upscale images

                // Calculate new dimensions
                let newWidth = compressedImg.width * scale;
                let newHeight = compressedImg.height * scale;

                // Add minimum padding for very small images (like 1x1)
                const minDisplaySize =
                  Math.min(canvas.width, canvas.height) * 0.3; // 30% of canvas size
                if (newWidth < minDisplaySize && newHeight < minDisplaySize) {
                  const paddingScale =
                    minDisplaySize / Math.max(newWidth, newHeight);
                  newWidth *= paddingScale;
                  newHeight *= paddingScale;
                }

                // Calculate position to center the image
                const x = (canvas.width - newWidth) / 2;
                const y = (canvas.height - newHeight) / 2;

                // Draw the image centered and scaled
                ctx.drawImage(compressedImg, x, y, newWidth, newHeight);

                setIsLoadedFromValue(true);
              };
              compressedImg.src = compressedDataUrl;
            } catch (error) {
              alert("Failed to load image. Please try a different image.");
            }
          };
          img.src = result;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col items-start">
      <div
        className={`relative ${isDragOver ? "ring-2 ring-blue-500 ring-opacity-50" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <SignatureCanvas
          ref={sigRef}
          penColor="black"
          canvasProps={{
            width,
            height,
            className: "border rounded bg-white",
            style: {
              pointerEvents: readOnly || isDragOver ? "none" : "auto",
            } as React.CSSProperties,
          }}
          backgroundColor="rgba(255,255,255,1)"
        />
        {isDragOver && !readOnly && (
          <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center rounded">
            <span className="text-blue-700 font-medium">Drop image here</span>
          </div>
        )}
      </div>
      {(showSave || showClear || showUpload) && (
        <div className="mt-2 flex gap-2 flex-wrap">
          {showUpload && !readOnly && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                className="btn btn-secondary btn-xs sm:btn-md"
                onClick={handleUploadClick}
                type="button"
              >
                Upload
              </button>
            </>
          )}
          {showSave && (
            <button
              className="btn btn-primary btn-xs sm:btn-md"
              onClick={handleSave}
            >
              {isLoadedFromValue ? "Save Again" : "Save"}
            </button>
          )}
          {showClear && (
            <button
              className="btn btn-error btn-xs sm:btn-md"
              onClick={handleClear}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SignaturePad;
