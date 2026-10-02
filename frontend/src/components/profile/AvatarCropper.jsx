import { useEffect, useRef, useState } from 'react'
import { Camera, Check, ImagePlus, Minus, Plus, RotateCcw, X } from 'lucide-react'

const VIEWPORT = 320
const OUTPUT_SIZE = 256

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

export default function AvatarCropper({ value, onChange }) {
  const inputRef = useRef(null)
  const imageRef = useRef(null)
  const [source, setSource] = useState('')
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef(null)

  const baseScale = naturalSize.width && naturalSize.height
    ? Math.max(VIEWPORT / naturalSize.width, VIEWPORT / naturalSize.height)
    : 1

  const scaledWidth = naturalSize.width * baseScale * zoom
  const scaledHeight = naturalSize.height * baseScale * zoom

  const centerPosition = () => ({
    x: (VIEWPORT - scaledWidth) / 2,
    y: (VIEWPORT - scaledHeight) / 2,
  })

  useEffect(() => {
    if (source && naturalSize.width) {
      setPosition(centerPosition())
    }
  }, [zoom, naturalSize.width, naturalSize.height])

  const openPicker = () => inputRef.current?.click()

  const handleFile = event => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    if (!file.type.startsWith('image/')) {
      window.alert('Please choose an image file.')
      return
    }

    if (file.size > 8 * 1024 * 1024) {
      window.alert('Please choose an image smaller than 8 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result || '')
      const image = new Image()
      image.onload = () => {
        imageRef.current = image
        setNaturalSize({ width: image.naturalWidth, height: image.naturalHeight })
        setZoom(1)
        setSource(url)
      }
      image.src = url
    }
    reader.readAsDataURL(file)
  }

  const startDrag = event => {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStart.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, startX: position.x, startY: position.y }
    setDragging(true)
  }

  const moveDrag = event => {
    if (!dragStart.current) return

    const nextX = dragStart.current.startX + event.clientX - dragStart.current.x
    const nextY = dragStart.current.startY + event.clientY - dragStart.current.y

    setPosition({
      x: clamp(nextX, VIEWPORT - scaledWidth, 0),
      y: clamp(nextY, VIEWPORT - scaledHeight, 0),
    })
  }

  const endDrag = () => {
    dragStart.current = null
    setDragging(false)
  }

  const resetCrop = () => {
    setZoom(1)
    setPosition(centerPosition())
  }

  const applyCrop = () => {
    const image = imageRef.current
    if (!image) return

    const scale = baseScale * zoom
    const cropSize = VIEWPORT / scale
    const sourceX = clamp(-position.x / scale, 0, image.naturalWidth - cropSize)
    const sourceY = clamp(-position.y / scale, 0, image.naturalHeight - cropSize)
    const safeCropSize = Math.min(cropSize, image.naturalWidth - sourceX, image.naturalHeight - sourceY)

    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE

    const context = canvas.getContext('2d')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      image,
      sourceX,
      sourceY,
      safeCropSize,
      safeCropSize,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE,
    )

    onChange(canvas.toDataURL('image/jpeg', 0.86))
    setSource('')
  }

  return (
    <div className="avatar-editor">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="avatar-file-input"
        onChange={handleFile}
      />

      <div className="avatar-editor-row">
        <div className="avatar-preview-large">
          {value ? <img src={value} alt="Profile" /> : <Camera size={24} />}
        </div>
        <div>
          <strong>Profile picture</strong>
          <p>Upload a photo and crop exactly what should be visible.</p>
          <button type="button" className="secondary avatar-upload-button" onClick={openPicker}>
            <ImagePlus size={15} />
            {value ? 'Change photo' : 'Upload photo'}
          </button>
        </div>
      </div>

      {source && (
        <div className="crop-modal-backdrop">
          <div className="crop-modal" role="dialog" aria-modal="true" aria-label="Crop profile picture">
            <div className="crop-modal-head">
              <div>
                <span className="eyebrow">PROFILE PHOTO</span>
                <h3>Crop your picture</h3>
                <p>Drag the photo and zoom until the exact part you want is inside the circle.</p>
              </div>
              <button type="button" className="crop-close" onClick={() => setSource('')} aria-label="Close cropper">
                <X size={18} />
              </button>
            </div>

            <div
              className="crop-viewport"
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onPointerLeave={endDrag}
              style={{ cursor: dragging ? 'grabbing' : 'grab' }}
            >
              <img
                src={source}
                alt="Crop preview"
                draggable="false"
                style={{
                  width: scaledWidth,
                  height: scaledHeight,
                  transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
                }}
              />
              <div className="crop-guide" />
            </div>

            <div className="crop-controls">
              <button type="button" onClick={() => setZoom(value => Math.max(1, +(value - 0.1).toFixed(1)))} aria-label="Zoom out">
                <Minus size={15} />
              </button>
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={zoom}
                onChange={event => setZoom(Number(event.target.value))}
                aria-label="Zoom"
              />
              <button type="button" onClick={() => setZoom(value => Math.min(3, +(value + 0.1).toFixed(1)))} aria-label="Zoom in">
                <Plus size={15} />
              </button>
              <button type="button" className="crop-reset" onClick={resetCrop}>
                <RotateCcw size={14} />
                Reset
              </button>
            </div>

            <div className="crop-modal-actions">
              <button type="button" className="secondary" onClick={() => setSource('')}>
                Cancel
              </button>
              <button type="button" className="primary" onClick={applyCrop}>
                <Check size={15} />
                Use this photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
