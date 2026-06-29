import React, { useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'



export function ImageWithFallback(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [didError, setDidError] = useState(false)

  const handleError = () => {
    setDidError(true)
  }

  const { src, alt, style, className, ...rest } = props

  return didError ? (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 text-gray-400 ${className ?? ''}`}
      style={style}
    >
      <ImageIcon className="w-1/3 h-1/3 opacity-20" />
    </div>
  ) : (
    <img src={src} alt={alt} className={className} style={style} {...rest} onError={handleError} />
  )
}
