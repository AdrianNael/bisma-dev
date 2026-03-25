export default {
  format: "A4",
  orientation: "landscape",
  border: { top: "0mm", right: "10mm", bottom: "0mm", left: "10mm" },
  header: {
    height: "30mm",
    contents: '',
  },
  footer: {
    height: "-20mm",
    contents: '' // Will be dynamically set in controller with footer image
  }
}
