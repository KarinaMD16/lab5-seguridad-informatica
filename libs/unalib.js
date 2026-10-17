// modulo de ejemplo.

// expresiones regulares para detectar el tipo de URL
// (no se permiten espacios, comillas ni < > dentro de la URL)
var RE_IMAGE = /^https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|gif|bmp|webp|svg)(?:[?#][^\s"'<>]*)?$/i;
var RE_VIDEO_FILE = /^https?:\/\/[^\s"'<>]+\.(?:mp4|webm|ogg|ogv|mov|m4v)(?:[?#][^\s"'<>]*)?$/i;
var RE_YT_VIDEO = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?(?:[^\s#]*&)?v=))([\w-]{11})(?:[?&#][^\s"'<>]*)?$/i;
var RE_COLOR = /^#[0-9a-f]{6}$/i;

// cualquier URL dentro de un texto (con o sin protocolo)
var RE_ANY_URL = /\b(?:(?:https?|ftp|file):\/\/|www\.)[^\s<>"']+/gi;

// patrones de codigo malicioso que se eliminan del texto
var RE_DANGEROUS_BLOCKS = /<(script|style|iframe|object|embed|applet|frame|frameset|svg|math|template|noscript)\b[\s\S]*?(?:<\/\1\s*>|$)/gi;
var RE_HTML_TAGS = /<\/?[a-z!?][^>]*>?/gi;
var RE_DANGEROUS_SCHEMES = /(?:javascript|vbscript|livescript)\s*:|data\s*:\s*[a-z]+\/[\w.+-]+/gi;
var RE_EVENT_HANDLERS = /\bon[a-z]+\s*=/gi;
var RE_CSS_EXPRESSION = /expression\s*\(/gi;
var RE_CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u2028-\u202E\u2066-\u2069\uFEFF]/g;

// nombre: letras (con acentos), numeros, espacio, punto, guion y guion bajo
var RE_NAME_INVALID_CHARS = /[^\p{L}\p{N} ._-]/gu;

var MAX_MESSAGE_LENGTH = 1000;
var MAX_URL_LENGTH = 2048;
var MAX_NAME_LENGTH = 30;
var BLOCKED_URL_TEXT = '[URL no permitida]';

module.exports = {

    // escapa caracteres especiales de HTML para evitar inyeccion de codigo (XSS)
    escapeHtml: function (text) {
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    // elimina etiquetas HTML, scripts, manejadores de eventos y esquemas peligrosos.
    // se repite hasta que el texto no cambie, para evitar ataques anidados
    // como "<scr<script>ipt>" o "javasjavascript:cript:"
    removeMaliciousCode: function (text) {
      var clean = String(text).normalize('NFKC').replace(RE_CONTROL_CHARS, '');
      var previous;
      var rounds = 0;

      do {
        previous = clean;
        clean = clean
          .replace(RE_DANGEROUS_BLOCKS, '')
          .replace(RE_HTML_TAGS, '')
          .replace(RE_DANGEROUS_SCHEMES, '')
          .replace(RE_EVENT_HANDLERS, '')
          .replace(RE_CSS_EXPRESSION, '');
        rounds++;
      } while (clean !== previous && rounds < 10);

      return clean;
    },

    // valida la estructura de la URL con el parser nativo URL:
    // solo http/https, con host, sin usuario/contrasena y sin caracteres peligrosos
    is_safe_url: function (url) {
      if (typeof url !== 'string' || url.length > MAX_URL_LENGTH || /[\s"'<>`\\]/.test(url)) {
        return false;
      }

      try {
        var parsed = new URL(url);
        return (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
          parsed.hostname.length > 0 &&
          parsed.username === '' &&
          parsed.password === '';
      } catch (e) {
        return false;
      }
    },

    // true si la URL es una imagen o un video permitido
    is_allowed_media_url: function (url) {
      return this.is_valid_url_image(url) || this.is_valid_yt_video(url) || this.is_valid_video_file(url);
    },

    // limpia y valida el nombre de usuario
    sanitizeName: function (name) {
      var clean = this.removeMaliciousCode(typeof name === 'string' ? name : '')
        .replace(RE_NAME_INVALID_CHARS, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_NAME_LENGTH);

      return clean || 'Anonimo';
    },

    // logica que valida si un telefono esta correcto...
    is_valid_phone: function (phone) {
      // inicializacion lazy
      var isValid = false;
      // expresion regular copiada de StackOverflow
      var re = /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/i;

      // validacion Regex
      try {
        isValid = re.test(phone);
      } catch (e) {
        console.log(e);
      } finally {
          return isValid;
      }
      // fin del try-catch block
    },

    // true si la URL apunta a una imagen (jpg, png, gif, ...)
    is_valid_url_image: function (url) {
      return typeof url === 'string' && RE_IMAGE.test(url.trim()) && this.is_safe_url(url.trim());
    },

    // true si la URL es un video de YouTube
    is_valid_yt_video: function (url) {
      return typeof url === 'string' && RE_YT_VIDEO.test(url.trim());
    },

    // true si la URL apunta a un archivo de video (mp4, webm, ogg, ...)
    is_valid_video_file: function (url) {
      return typeof url === 'string' && RE_VIDEO_FILE.test(url.trim()) && this.is_safe_url(url.trim());
    },

    getYTVideoId: function(url){
      var match = String(url).trim().match(RE_YT_VIDEO);
      return match ? match[1] : null;
    },

    getEmbeddedCode: function (url){
      var id = this.getYTVideoId(url);
      var code = '<iframe class="chat-video" width="560" height="315" src="https://www.youtube.com/embed/'+id+ '" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
      return code;
    },

    getVideoTag: function(url){
      var tag = '<video class="chat-video" controls preload="metadata" src="'+this.escapeHtml(url.trim())+'">Su navegador no soporta video.</video>';
      return tag;
    },

    getImageTag: function(url){
      var tag = '<img class="chat-image" src="'+this.escapeHtml(url.trim())+'" alt="imagen">';
      return tag;
    },

    // convierte el texto del mensaje en HTML seguro:
    // - si todo el mensaje es una URL de imagen/video valida, se inserta el medio
    // - si no, se elimina el codigo malicioso, se bloquean las URLs que no sean
    //   de imagen/video y el resultado se escapa como texto
    formatMessage: function(text){
      text = (typeof text === 'string') ? text.trim() : '';

      if(this.is_valid_url_image(text)){
        console.log("Es una imagen!")
        return this.getImageTag(text);
      }
      else if(this.is_valid_yt_video(text)){
        console.log("Es un video de YouTube!")
        return this.getEmbeddedCode(text);
      }
      else if(this.is_valid_video_file(text)){
        console.log("Es un video!")
        return this.getVideoTag(text);
      }

      console.log("Es un texto!")
      var self = this;
      var clean = this.removeMaliciousCode(text).replace(RE_ANY_URL, function(url){
        return self.is_allowed_media_url(url) ? url : BLOCKED_URL_TEXT;
      });

      return this.escapeHtml(clean.trim());
    },

    // valida, limpia y formatea un mensaje JSON { nombre, mensaje, color }.
    // devuelve mensaje vacio si la entrada no es valida (el servidor no la reenvia)
    validateMessage: function(msg){
      var empty = JSON.stringify({ nombre: '', color: '#000000', mensaje: '' });

      if (!msg || typeof msg !== 'string' || msg.length > MAX_MESSAGE_LENGTH * 4) {
        return empty;
      }

      try {
        var obj = JSON.parse(msg);

        if (!obj || typeof obj !== 'object' || typeof obj.mensaje !== 'string' ||
            obj.mensaje.length > MAX_MESSAGE_LENGTH) {
          return empty;
        }

        return JSON.stringify({
          nombre: this.escapeHtml(this.sanitizeName(obj.nombre)),
          color: (typeof obj.color === 'string' && RE_COLOR.test(obj.color)) ? obj.color : '#000000',
          mensaje: this.formatMessage(obj.mensaje)
        });
      } catch (e) {
        console.log('Error processing message:', e.message);
        return empty;
      }
    },

    // alias en espanol
    validarMensaje: function(msg){
      return this.validateMessage(msg);
    }

  // fin del modulo
  };
