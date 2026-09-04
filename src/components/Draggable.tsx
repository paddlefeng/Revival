import React, { useRef, useEffect, useState } from "react";

interface DraggableProps {
  children: React.ReactNode;
  position: { x: number; y: number }; // 百分比 (0-100)，相对于父容器
  onPositionChange: (pos: { x: number; y: number }) => void;
  boundaryRef?: React.RefObject<HTMLElement>; // 限制拖拽范围的父容器
  disabled?: boolean;
}

export function Draggable({ children, position, onPositionChange, boundaryRef, disabled = false }: DraggableProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ clientX: 0, clientY: 0, percentX: 0, percentY: 0 });
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (disabled) return;
      const dx = e.clientX - dragStart.current.clientX;
      const dy = e.clientY - dragStart.current.clientY;

      let newPercentX = dragStart.current.percentX + (dx / (boundaryRef?.current?.clientWidth || window.innerWidth)) * 100;
      let newPercentY = dragStart.current.percentY + (dy / (boundaryRef?.current?.clientHeight || window.innerHeight)) * 100;

      // 边界限制 (0-100)
      newPercentX = Math.min(100, Math.max(0, newPercentX));
      newPercentY = Math.min(100, Math.max(0, newPercentY));

      onPositionChange({ x: newPercentX, y: newPercentY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, disabled, boundaryRef, onPositionChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      percentX: position.x,
      percentY: position.y,
    };
  };

  return (
    <div
      ref={elementRef}
      style={{
        position: "absolute",
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: "translate(-50%, -50%)",
        cursor: disabled ? "default" : "grab",
        userSelect: "none",
        zIndex: 30,
      }}
      onMouseDown={handleMouseDown}
    >
      {children}
    </div>
  );
}