"use client";

import { useEffect } from "react";

const PRESS_ANIMATION_CLASS = "button-press-pop";
const INTERACTIVE_PRESS_SELECTOR = 'button, [role="button"], a[href]';

export function ButtonPressEffect() {
  useEffect(() => {
    const animateInteractiveElement = (target: EventTarget | null) => {
      if (!(target instanceof Element)) {
        return;
      }

      const interactiveElement = target.closest(INTERACTIVE_PRESS_SELECTOR);
      if (!(interactiveElement instanceof HTMLElement)) {
        return;
      }

      if (interactiveElement instanceof HTMLButtonElement && interactiveElement.disabled) {
        return;
      }

      interactiveElement.classList.remove(PRESS_ANIMATION_CLASS);
      void interactiveElement.offsetWidth;
      interactiveElement.classList.add(PRESS_ANIMATION_CLASS);
    };

    const triggerPressAnimation = (event: PointerEvent) => {
      animateInteractiveElement(event.target);
    };

    const triggerKeyboardAnimation = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      animateInteractiveElement(event.target);
    };

    const clearAnimationClass = (event: AnimationEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      target.classList.remove(PRESS_ANIMATION_CLASS);
    };

    document.addEventListener("pointerdown", triggerPressAnimation, true);
    document.addEventListener("keydown", triggerKeyboardAnimation, true);
    document.addEventListener("animationend", clearAnimationClass, true);

    return () => {
      document.removeEventListener("pointerdown", triggerPressAnimation, true);
      document.removeEventListener("keydown", triggerKeyboardAnimation, true);
      document.removeEventListener("animationend", clearAnimationClass, true);
    };
  }, []);

  return null;
}
