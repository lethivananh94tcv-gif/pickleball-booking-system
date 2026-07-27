export function getImageUrl(path?: string | null, fallback: string = "/images/coaches/hlv1.png"): string {
  if (!path) return fallback;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  if (path.startsWith("/images/")) {
    return path;
  }
  const relativePath = path.startsWith("/") ? path : `/${path}`;
  return `http://localhost:5000${relativePath}`;
}

export function getCoachImageUrl(imagePath?: string | null): string {
  const fallback = "/images/coaches/hlv1.png";
  if (!imagePath) return fallback;
  
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://") || imagePath.startsWith("data:")) {
    return imagePath;
  }
  if (imagePath.startsWith("/images/coaches/")) {
    return imagePath;
  }
  if (imagePath.startsWith("images/coaches/")) {
    return `/${imagePath}`;
  }
  if (imagePath.startsWith("/images/users/")) {
    return fallback;
  }
  if (imagePath.startsWith("/uploads/")) {
    return `http://localhost:5000${imagePath}`;
  }
  // Nếu chỉ là tên file như hlv7.png (không có dấu /)
  if (!imagePath.includes("/")) {
    return `/images/coaches/${imagePath}`;
  }
  
  return fallback;
}
