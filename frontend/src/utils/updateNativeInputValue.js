export default function updateNativeInputValue(input, value) {
    if (!input) return;

    const prototype =
        input.tagName === "TEXTAREA"
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;

    const setter = Object.getOwnPropertyDescriptor(
        prototype,
        "value"
    )?.set;

    setter?.call(input, value);

    input.dispatchEvent(
        new Event("input", {
            bubbles: true,
        })
    );
}