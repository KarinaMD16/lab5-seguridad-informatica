var val = require('../libs/unalib');
var assert = require('assert');


describe('unalib', function(){


  describe('funcion is_valid_phone', function(){

    it('deberia devolver true para 8297-8547', function(){

      assert.equal(val.is_valid_phone('8297-8547'), false); // ERROR INTENCIONAL para bloquear el deploy

    });

    it('deberia devolver false para 8297p-8547', function(){

      assert.equal(val.is_valid_phone('8297p-8547'), false);

    });

  });


  describe('funcion is_valid_url_image', function(){

    it('deberia devolver true para http://image.com/image.jpg', function(){

      assert.equal(val.is_valid_url_image('http://image.com/image.jpg'), true);

    });

    it('deberia devolver true para http://image.com/image.gif', function(){

      assert.equal(val.is_valid_url_image('http://image.com/image.gif'), true);

    });
    
  });

  describe('funcion is_valid_yt_video', function(){

    it('deberia devolver true para http://image.com/image.jpg', function(){

      assert.equal(val.is_valid_yt_video('https://www.youtube.com/watch?v=qYwlqx-JLok'), true);

    });

  });

  // ---------------------------------------------------------------
  // funcion auxiliar: envia un mensaje por validateMessage y devuelve el objeto resultante
  function enviar(mensaje, nombre){
    var entrada = JSON.stringify({ nombre: nombre || 'Ana', mensaje: mensaje, color: '#123ABC' });
    return JSON.parse(val.validateMessage(entrada));
  }


  describe('validacion de URLs de imagenes', function(){

    it('deberia aceptar imagenes jpg, jpeg, png, gif, bmp, webp y svg', function(){

      ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].forEach(function(ext){
        assert.equal(val.is_valid_url_image('https://cdn.com/foto.' + ext), true, ext);
      });

    });

    it('deberia aceptar imagenes con extension en mayusculas', function(){

      assert.equal(val.is_valid_url_image('https://cdn.com/FOTO.PNG'), true);

    });

    it('deberia aceptar imagenes con query string', function(){

      assert.equal(val.is_valid_url_image('https://cdn.com/foto.png?w=200&h=100'), true);

    });

    it('deberia rechazar texto normal', function(){

      assert.equal(val.is_valid_url_image('hola mundo'), false);

    });

    it('deberia rechazar una URL que no es imagen', function(){

      assert.equal(val.is_valid_url_image('https://cdn.com/documento.pdf'), false);

    });

    it('deberia rechazar una URL de video', function(){

      assert.equal(val.is_valid_url_image('https://cdn.com/clip.mp4'), false);

    });

    it('deberia rechazar URLs sin protocolo http/https', function(){

      assert.equal(val.is_valid_url_image('ftp://cdn.com/foto.jpg'), false);
      assert.equal(val.is_valid_url_image('cdn.com/foto.jpg'), false);

    });

    it('deberia mostrar la imagen como una etiqueta <img> en el mensaje', function(){

      var res = enviar('http://image.com/image.jpg');
      assert.equal(res.mensaje.indexOf('<img'), 0);
      assert.ok(res.mensaje.indexOf('src="http://image.com/image.jpg"') > -1);
      assert.ok(res.mensaje.indexOf('class="chat-image"') > -1);

    });

    it('deberia mostrar la imagen aunque tenga espacios alrededor', function(){

      assert.equal(enviar('   http://image.com/image.jpg   ').mensaje.indexOf('<img'), 0);

    });

    it('deberia escapar el & de la URL dentro del atributo src', function(){

      var res = enviar('https://cdn.com/foto.png?w=200&h=100');
      assert.ok(res.mensaje.indexOf('src="https://cdn.com/foto.png?w=200&amp;h=100"') > -1);

    });

  });


  describe('validacion de URLs de videos', function(){

    describe('videos de YouTube', function(){

      var urlsValidas = [
        'https://www.youtube.com/watch?v=qYwlqx-JLok',
        'http://youtube.com/watch?v=qYwlqx-JLok',
        'https://youtu.be/qYwlqx-JLok',
        'https://www.youtube.com/embed/qYwlqx-JLok',
        'https://www.youtube.com/shorts/qYwlqx-JLok',
        'https://m.youtube.com/watch?v=qYwlqx-JLok',
        'https://www.youtube.com/watch?v=qYwlqx-JLok&t=30s'
      ];

      urlsValidas.forEach(function(url){
        it('deberia aceptar ' + url, function(){
          assert.equal(val.is_valid_yt_video(url), true);
          assert.equal(val.getYTVideoId(url), 'qYwlqx-JLok');
        });
      });

      it('deberia rechazar una URL de YouTube sin id de video', function(){

        assert.equal(val.is_valid_yt_video('https://www.youtube.com/'), false);

      });

      it('deberia rechazar un dominio que imita a YouTube', function(){

        assert.equal(val.is_valid_yt_video('https://youtube.com.evil.com/watch?v=qYwlqx-JLok'), false);

      });

      it('deberia integrar el reproductor de YouTube con un <iframe> de embed', function(){

        var res = enviar('https://www.youtube.com/watch?v=qYwlqx-JLok');
        assert.equal(res.mensaje.indexOf('<iframe'), 0);
        assert.ok(res.mensaje.indexOf('src="https://www.youtube.com/embed/qYwlqx-JLok"') > -1);
        assert.ok(res.mensaje.indexOf('allowfullscreen') > -1);

      });

      it('deberia usar siempre el dominio oficial en el reproductor', function(){

        var res = enviar('https://youtu.be/qYwlqx-JLok');
        assert.ok(res.mensaje.indexOf('https://www.youtube.com/embed/qYwlqx-JLok') > -1);

      });

    });

    describe('archivos de video', function(){

      it('deberia aceptar videos mp4, webm, ogg, ogv, mov y m4v', function(){

        ['mp4', 'webm', 'ogg', 'ogv', 'mov', 'm4v'].forEach(function(ext){
          assert.equal(val.is_valid_video_file('https://cdn.com/clip.' + ext), true, ext);
        });

      });

      it('deberia rechazar una URL de imagen', function(){

        assert.equal(val.is_valid_video_file('https://cdn.com/foto.jpg'), false);

      });

      it('deberia rechazar texto normal', function(){

        assert.equal(val.is_valid_video_file('mi video favorito'), false);

      });

      it('deberia integrar un reproductor <video> con controles', function(){

        var res = enviar('https://cdn.com/clip.mp4');
        assert.equal(res.mensaje.indexOf('<video'), 0);
        assert.ok(res.mensaje.indexOf('controls') > -1);
        assert.ok(res.mensaje.indexOf('src="https://cdn.com/clip.mp4"') > -1);
        assert.ok(res.mensaje.indexOf('</video>') > -1);

      });

    });

  });


  describe('prevencion de inyeccion de scripts', function(){

    // verifica que el HTML resultante no contenga codigo ejecutable
    function sinCodigoPeligroso(html){
      assert.ok(!/<script|<iframe|<img|<svg|<object|<embed|javascript:|on[a-z]+\s*=/i.test(html),
        'contiene codigo peligroso: ' + html);
    }

    var ataques = [
      '<script>alert(1)</script>',
      '<SCRIPT SRC=http://evil.com/x.js></SCRIPT>',
      '<scr<script>ipt>alert(1)</script>',
      '<<script>script>alert(1)<</script>/script>',
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(1)>',
      '<body onload=alert(1)>',
      '<iframe src="javascript:alert(1)"></iframe>',
      '<a href="javascript:alert(1)">clic</a>',
      'javasjavascript:cript:alert(1)',
      '<object data="data:text/html,<script>alert(1)</script>"></object>',
      '<embed src="http://evil.com/x.swf">',
      '<div style="width:expression(alert(1))">x</div>'
    ];

    ataques.forEach(function(ataque){
      it('deberia bloquear: ' + ataque, function(){
        sinCodigoPeligroso(enviar(ataque).mensaje);
      });
    });

    it('deberia conservar el texto alrededor del codigo eliminado', function(){

      assert.equal(enviar('hola <script>alert(1)</script>mundo').mensaje, 'hola mundo');

    });

    it('deberia dejar el texto normal sin cambios', function(){

      assert.equal(enviar('hola mundo').mensaje, 'hola mundo');

    });

    it('deberia escapar los simbolos < y > sueltos', function(){

      assert.equal(enviar('3 < 5 y 7 > 2').mensaje, '3 &lt; 5 y 7 &gt; 2');

    });

    it('deberia eliminar codigo del nombre de usuario', function(){

      assert.equal(enviar('hola', '<script>alert(1)</script>Ana').nombre, 'Ana');
      assert.equal(enviar('hola', '<b>Ana</b>').nombre, 'Ana');

    });

    it('deberia usar "Anonimo" si el nombre queda vacio', function(){

      assert.equal(enviar('hola', '<script>x</script>').nombre, 'Anonimo');

    });

    it('no deberia aceptar una URL de imagen con comillas (inyeccion de atributos)', function(){

      sinCodigoPeligroso(enviar('http://x.com/a.jpg" onerror="alert(1)').mensaje);

    });

    it('no deberia aceptar imagenes con esquema javascript: o data:', function(){

      sinCodigoPeligroso(enviar('javascript:alert(1)//.jpg').mensaje);
      sinCodigoPeligroso(enviar('data:image/png;base64,AAAA').mensaje);

    });

    it('no deberia aceptar URLs de imagen con usuario y contrasena', function(){

      assert.equal(enviar('http://user:pass@evil.com/a.jpg').mensaje.indexOf('<img'), -1);

    });

    it('deberia bloquear URLs que no son imagenes ni videos', function(){

      assert.equal(enviar('visita http://phishing.com/login').mensaje, 'visita [URL no permitida]');
      assert.equal(enviar('www.malware.com').mensaje, '[URL no permitida]');

    });

    it('deberia reemplazar un color invalido (inyeccion de CSS)', function(){

      var entrada = JSON.stringify({ nombre: 'Ana', mensaje: 'hola', color: "red'><script>alert(1)</script>" });
      assert.equal(JSON.parse(val.validateMessage(entrada)).color, '#000000');

    });

    it('deberia rechazar mensajes que no son JSON valido', function(){

      assert.equal(JSON.parse(val.validateMessage('<script>alert(1)</script>')).mensaje, '');
      assert.equal(JSON.parse(val.validateMessage(null)).mensaje, '');

    });

    it('deberia rechazar mensajes cuyo texto no es un string', function(){

      assert.equal(JSON.parse(val.validateMessage(JSON.stringify({ mensaje: { html: '<script>' } }))).mensaje, '');

    });

    it('deberia rechazar mensajes demasiado largos', function(){

      assert.equal(enviar(new Array(1002).join('a')).mensaje, '');

    });

  });

});







