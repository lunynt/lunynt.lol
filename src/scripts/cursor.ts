const cursor = document.querySelector<HTMLElement>("[data-cursor]");

if (cursor && window.matchMedia("(pointer: fine)").matches) {
  const move = (event: PointerEvent): void => {
    cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
    cursor.classList.add("is-visible");
  };

  window.addEventListener("pointermove", move, { passive: true });
  document.addEventListener("mouseleave", () =>
    cursor.classList.remove("is-visible"),
  );
  document.addEventListener("mouseenter", () =>
    cursor.classList.add("is-visible"),
  );
}

export {};
