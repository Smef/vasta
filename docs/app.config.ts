export default defineAppConfig({
  seo: {},
  header: {
    title: "Vasta",
    logo: {
      light: "/img/logo/logo-dark.svg",
      dark: "/img/logo/logo-light.svg",
      alt: "Vasta Logo",
      wordmark: {
        light: "/img/logo/wordmark-dark.svg",
        dark: "/img/logo/wordmark-light.svg",
      },
      display: "wordmark", // "logo" | "wordmark" | "both"
      favicon: "/img/favicon/favicon.ico",
      // brandAssetsUrl: "https://example.com/brand",
    },
  },
  ui: {
    colors: {
      primary: "purple",
      neutral: "neutral",
    },
  },
});
