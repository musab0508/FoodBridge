import cv2
import numpy as np

class OpenCVImageInspector:
    """
    OpenCV-based Spoilage & Image Quality Inspection Engine.
    Performs automated computer vision checks for:
    1. Blur Detection using Laplacian Variance.
    2. Brightness & Contrast balance analysis to reject unreadable or dark food photos.
    """

    MIN_LAPLACIAN_VAR = 35.0  # Threshold for sharpness/blur
    MIN_BRIGHTNESS = 30.0     # Reject overly dark photos
    MAX_BRIGHTNESS = 240.0    # Reject overexposed/washed-out photos

    @classmethod
    def inspect_image_bytes(cls, image_bytes: bytes) -> dict:
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is None:
                return {
                    'verified': False,
                    'quality_score': 0.0,
                    'message': 'Failed to decode image file format.'
                }

            return cls.inspect_mat(img)
        except Exception as e:
            return {
                'verified': False,
                'quality_score': 0.0,
                'message': f'Image processing error: {str(e)}'
            }

    @classmethod
    def inspect_mat(cls, img_mat: np.ndarray) -> dict:
        gray = cv2.cvtColor(img_mat, cv2.COLOR_BGR2GRAY)

        # 1. Blur Detection via Laplacian Variance
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        is_sharp = laplacian_var >= cls.MIN_LAPLACIAN_VAR

        # 2. Brightness & Contrast Analysis
        mean_brightness = float(np.mean(gray))
        std_contrast = float(np.std(gray))
        is_well_lit = (cls.MIN_BRIGHTNESS <= mean_brightness <= cls.MAX_BRIGHTNESS)

        # 3. Overall Quality Score (0 - 100%)
        blur_score = min(50.0, (laplacian_var / 100.0) * 50.0)
        light_score = min(50.0, max(0.0, 50.0 - abs(mean_brightness - 128.0) * 0.35))
        quality_score = min(99.9, max(10.0, round(blur_score + light_score, 1)))

        verified = is_sharp and is_well_lit

        if not is_sharp:
            msg = f"⚠️ Image rejected: Photo is too blurry (Sharpness: {round(laplacian_var, 1)} < {cls.MIN_LAPLACIAN_VAR}). Please upload a clear photo."
        elif not is_well_lit:
            msg = f"⚠️ Image rejected: Lighting issues detected (Brightness: {round(mean_brightness, 1)}). Ensure food photo is well-lit."
        else:
            msg = f"✅ Image Verified Clean & Clear (Quality Score: {quality_score}%, Sharpness: {round(laplacian_var, 1)})"

        return {
            'verified': verified,
            'quality_score': quality_score,
            'blur_variance': round(laplacian_var, 2),
            'mean_brightness': round(mean_brightness, 2),
            'std_contrast': round(std_contrast, 2),
            'message': msg
        }
