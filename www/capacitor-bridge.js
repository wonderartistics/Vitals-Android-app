// ---------------------------------------------------------------------------
// Native file save/share bridge.
//
// In a plain browser, `<a download>` clicks and doc.save() work fine.
// Inside a packaged Android app (Capacitor's WebView), blob-URL "download"
// clicks are silently swallowed — there's no Android DownloadManager hook for
// them, so PDF export and backup export would appear to do nothing.
//
// This bridge detects whether it's running natively and, if so, writes the
// file into the app's cache directory via the Filesystem plugin and opens
// the native Share sheet (so the user can save it to Downloads, Drive,
// email it, etc). On the web it's a no-op passthrough to the original
// blob-download approach.
// ---------------------------------------------------------------------------
(function(){
  function isNative(){
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }

  function blobToBase64(blob){
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onloadend = ()=> resolve(String(reader.result).split(",")[1] || "");
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function webDownload(filename, blob){
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { method: "web-download" };
  }

  async function nativeSaveAndShare(filename, blob, mimeType, shareTitle){
    const plugins = window.Capacitor.Plugins || {};
    const { Filesystem, Share } = plugins;
    if(!Filesystem || !Share){
      // Plugins not registered (e.g. dev build without them) — fall back gracefully.
      return webDownload(filename, blob);
    }
    const base64 = await blobToBase64(blob);
    const written = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: "CACHE", // Capacitor Directory.Cache
      recursive: true
    });
    await Share.share({
      title: shareTitle || filename,
      url: written.uri,
      dialogTitle: shareTitle || "Save or share file"
    });
    return { method: "native-share", uri: written.uri };
  }

  window.NativeFile = {
    isNative,
    /**
     * Save a Blob to disk / hand it to the OS share sheet.
     * @param {string} filename
     * @param {Blob} blob
     * @param {string} mimeType
     * @param {string} [shareTitle]
     */
    async saveBlob(filename, blob, mimeType, shareTitle){
      if(isNative()){
        try{
          return await nativeSaveAndShare(filename, blob, mimeType, shareTitle);
        }catch(err){
          console.error("Native save failed, falling back to web download:", err);
          return webDownload(filename, blob);
        }
      }
      return webDownload(filename, blob);
    }
  };
})();
