self.__BUILD_MANIFEST = {
  "__rewrites": {
    "afterFiles": [
      {
        "source": "/cert/:id",
        "destination": "/api/cert?id=:id"
      },
      {
        "source": "/u/:username",
        "destination": "/api/storefront-html?username=:username"
      },
      {
        "source": "/",
        "destination": "/spa/index.html"
      },
      {
        "source": "/:path((?!api/|_next/|spa/|static/|favicon\\.ico).*)",
        "destination": "/spa/index.html"
      }
    ],
    "beforeFiles": [],
    "fallback": []
  },
  "sortedPages": [
    "/_app",
    "/_error"
  ]
};self.__BUILD_MANIFEST_CB && self.__BUILD_MANIFEST_CB()