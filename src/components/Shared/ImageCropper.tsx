"use client";

import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { X, Crop } from "lucide-react";
import Loader from "@/components/UI/Loader";
import styles from "./ImageCropper.module.css";

interface ImageCropperProps {
    imageSrc: string;
    onClose: () => void;
    onCropComplete: (croppedBlob: Blob) => Promise<void>;
}

const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener("load", () => resolve(image));
        image.addEventListener("error", (error) => reject(error));
        image.setAttribute("crossOrigin", "anonymous"); // needed to avoid CORS issues
        image.src = url;
    });

import { useModal } from "@/hooks/useModal";

export default function ImageCropper({ imageSrc, onClose, onCropComplete }: ImageCropperProps) {
    useModal(true, onClose);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ width: number; height: number; x: number; y: number } | null>(null);
    const [isCropping, setIsCropping] = useState(false);

    const onCropChange = (location: { x: number; y: number }) => {
        setCrop(location);
    };

    const onZoomChange = (zoomValue: number) => {
        setZoom(zoomValue);
    };

    const handleCropComplete = useCallback((_croppedArea: any, croppedAreaPixelsVal: any) => {
        setCroppedAreaPixels(croppedAreaPixelsVal);
    }, []);

    const extractCroppedImage = async () => {
        if (!croppedAreaPixels) return;
        setIsCropping(true);
        try {
            const image = await createImage(imageSrc);
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            if (!ctx) {
                throw new Error("No 2d context");
            }

            // We want exactly a 150x150 output
            canvas.width = 150;
            canvas.height = 150;

            // Draw the cropped area from the original image onto the 150x150 canvas
            ctx.drawImage(
                image,
                croppedAreaPixels.x,
                croppedAreaPixels.y,
                croppedAreaPixels.width,
                croppedAreaPixels.height,
                0,
                0,
                150,
                150
            );

            // Convert to a File/Blob (Canvas output inherently strips all EXIF metadata!)
            canvas.toBlob(
                async (blob) => {
                    if (blob) {
                        // Rename the blob so it uploads with a .webp extension
                        const webpBlob = new Blob([blob], { type: "image/webp" });
                        await onCropComplete(webpBlob);
                        setIsCropping(false);
                    }
                },
                "image/webp",
                0.8 // WebP compression ratio (0.8 provides excellent quality at tiny file size)
            );
        } catch (e) {
            console.error("Cropping failed", e);
            setIsCropping(false);
        }
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h3>Crop Profile Picture</h3>
                    <button className={styles.closeBtn} onClick={onClose} disabled={isCropping}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.cropContainer}>
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        aspect={1} // 1:1 aspect ratio for squares/circles
                        cropShape="round" // show circular crop area, output will be 300x300 square
                        showGrid={false}
                        onCropChange={onCropChange}
                        onCropComplete={handleCropComplete}
                        onZoomChange={onZoomChange}
                    />
                </div>

                <div className={styles.controls}>
                    <label>Zoom</label>
                    <input
                        type="range"
                        value={zoom}
                        min={1}
                        max={3}
                        step={0.1}
                        aria-labelledby="Zoom"
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className={styles.slider}
                    />
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={onClose} disabled={isCropping}>
                        Cancel
                    </button>
                    <button className={styles.confirmBtn} onClick={extractCroppedImage} disabled={isCropping}>
                        {isCropping ? <Loader variant="button" /> : <Crop size={18} />}
                        {isCropping ? "Optimizing..." : "Crop & Upload"}
                    </button>
                </div>
            </div>
        </div>
    );
}
