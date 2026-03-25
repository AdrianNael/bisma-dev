export default {
  formate: "A4",
  orientation: "landscape",
  border: "0mm",
  header: {
    height: "40mm",
    contents: "",
  },
  footer: {
    height: "20mm",
    contents: {
      default: "",
    },
  },
  childProcessOptions: {
    env: {
      OPENSSL_CONF: '/dev/null',
    },
  },
};
