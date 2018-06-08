var vm = new Vue({
  el: '#app',
  data() {
    return {
      socket: '', //与服务器进行连接  io.connect('http://192.168.1.62:18000')
      secretKey: 'pcdd@2017724@MDAFUCK@123#3306#$',
      strKey:"123456", //加密密文
      vi: '03216548',
      uname: null,
      group: null,
      toname: null,
      showEmojis: false,
      emoji:{},
      intext: '',
      oss: {
        accessid: '',
        host:'',
        okey:'',
        pbase64:'',
        signature:''
      },
      dir: "upload/",
      file:'',
      uploading:false,
      soundV: "../images/sound.png"
    }
  },
  beforeCreate() {
   
  },
  mounted() {
     var _this = this;
     $.ajax({
       type: 'GET',
       url: 'https://www.pcddapi.net/api/v0/system/getOssInfo.api',
       async: false,
       success(resp) {
         console.log(resp);
         if (resp != null) {
           _this.socket = io.connect(resp.socketUrl);
           _this._init();
         }
         console.log(_this.socket);
       }
     })
  },
  watch: {
    file (n,o){
      console.log(n);
      this.sendPrivateImg();
    }
  },
  methods: { 
    _init() {
    console.log(this.$refs.from.value);
    this.$nextTick( function (){
        this.emoji = aEmoji.map;
        let _this = this;
        //接收来自服务端的信息事件c_hi
        this.socket.on('hi', function (msg) {
          console.log(msg)
        })
        this.socket.on('groupchat', function (msg) {
          console.log(msg)
        })
        this.socket.on('conn', function (msg) {
          console.log(msg)
        })
        this.socket.on('onechat', function (msg) {
          _this.showText(msg);
        })
        this.socket.on('kick', function (msg) {
          console.log(msg)
        })
        this.socket.on('isLive', function (msg) {
          console.log(msg)
        })
        this.socket.on('isOnline', function (msg) {
          console.log(msg)
        })
        this.socket.on('error', function (msg) {
          console.log(msg)
        })
        this.socket.on('otherLogin', function (msg) {
          console.log(msg)
        })
        // oss 校验调用
        this.getddApi();
    })
    },
    sendAddUser() { //登录 加入聊天
      this.uname = this.$refs.from.value;
      this.group = this.$refs.group.value;
      if (this.uname != '') {
        var strmd5 = hex_md5(this.uname + this.secretKey);
          this.socket.emit('addUser', {
                'from': this.uname,
                'to': 'group1',
                'msg': 'msg111',
                'group': this.group,
                'signature': strmd5
              }, function (data) {
            console.log('',data);
          });
          alert('连接成功');
      } else {
        alert('请输入发送者名称');
      }
    },
    // 发送消息 
    sendOne () {
      var uname = this.$refs.from.value;
      var toname = this.$refs.toname.value;
      this.intext = this.$refs.sendtext.value;
      if (toname !='') {
        this.socket.emit('onechat', {
          'from': uname,
          'reciveId': toname,
          'type': 1,
          'msg': this.intext
        });
        intext = '';
      } else {
        alert('请输入接收者姓名');
        return;
      }
    },
    showText (msg) {
      console.log('内容', msg);
      if (msg.type == 2) { //收到的是图片消息
        this.createConcatImage(msg);
      } else if (msg.type == 3){//收到的是语音消息
        this.createConcatVoice(msg);
      } else  {//发送的是文字/emoji
        var html = '';
        html = '<div class="mess"><h4>' + msg.from + ':</h4>' + this.transEmojiText(msg.msg)+'</div>';
        var box = $('#box');
        box.append(html);
        this.$refs.sendtext.value = '';
      }
    },
    createConcatImage(data) {//图片消息的处理
      var _this = this;
      var url = this.oss.host + "/" + data.msg;
      var xmlhttp;
      if (window.XMLHttpRequest) { // code for IE7+, Firefox, Chrome, Opera, Safari
        xmlhttp = new XMLHttpRequest();
      } else { // code for IE6, IE5
        xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
      }
       xmlhttp.onreadystatechange = function () {
           if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
             // 消息上传成功
             var responseText = xmlhttp.responseText;
             var content = "";
             if (url.indexOf(".text") > 0) {
               suffix = _this.get_suffix(url);
               responseText = responseText.replace(/\s/g, "").replace(/\n/g, "").replace(/\t/g, ""); //
               var baseContent = _this.decrypt(responseText, _this.secretKey, _this.vi);
               // console.log(url, suffix, baseContent, responseText, _this.secretKey, _this.vi);
             }
          //接受二进制文件流
          // var responseText = xhr.responseText.replace(/\s/g, "").replace(/\n/g, "").replace(/\t/g, ""); //
          // var baseContent = _this.decrypt(responseText, _this.cryptKey, _this.vi); //
          var html = '';
          html = '<div class="mess"><h4>' + data.from + ':</h4>' + "<img class='sendImg'   src=" + baseContent + ' />' + '</div>';
          var box = $('#box');
          box.append(html);
        }
      }
      xmlhttp.open('GET', url, true);
      xmlhttp.send();
    },
    createConcatVoice(data){//语音消息处理
      var _this = this;
      var url = this.oss.host + "/" + data.msg;
      var timestampv = Date.parse(new Date()) / 1000;
      var xmlhttp;
      if (window.XMLHttpRequest) { // code for IE7+, Firefox, Chrome, Opera, Safari
        xmlhttp = new XMLHttpRequest();
      } else { // code for IE6, IE5
        xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
      }
      xmlhttp.onreadystatechange = function () {
        if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
          // 消息上传成功
          var responseText = xmlhttp.responseText;
          var content = "";
          if (url.indexOf(".temp") > 0) {
            suffix = _this.get_suffix(url);
            responseText = responseText.replace(/\s/g, "").replace(/\n/g, "").replace(/\t/g, ""); //
            var baseContent = _this.decrypt(responseText, _this.secretKey, _this.vi);
            // console.log(url, suffix, baseContent, responseText, _this.secretKey, _this.vi);
          }
          //接受二进制文件流
          var voc = document.createElement('audio');
          var soc = document.createElement('source')
          voc.id = "Vc" + timestampv;
          voc.controls = 'controls';
          soc.src = "" + baseContent + "";
          voc.appendChild(soc);
          document.querySelector("#box").appendChild(voc);
          var html = '';
          html = '<div class="mess"><h4>' + data.from + ':</h4>' + "<div  class='hasSound Vc" + timestampv + "' @click='playSound(" + baseContent, voc.id + ")' style='width:5rem'>" +
            "<img src=" + _this.soundV + "></div>";
          var box = $('#box');
          box.append(html);
        }
      }
      xmlhttp.open('GET', url, true);
      xmlhttp.send();

    },
    playSound(url, id) {
      update();
      var oVoice = document.getElementById(id);
      angular.element('.' + id).click(function ($event) {
        if (oVoice.paused) {
          $(this).find('img').attr('src', '../images/sound-p.gif');
          oVoice.play();
        } else {
          $(this).find('img').attr('src', '../images/sound.png');
          oVoice.pause();
        }
        var _this = $(this);
        var isEnded = setInterval(function () {
          if (oVoice.ended) {
            _this.find('img').attr('src', '../images/sound.png');
            clearInterval(isEnded);
          }
        }, 1000);
      });
    },
    showEmoji() {
      this.showEmojis = true;
    },
    select (item) {
      console.log(item);
      console.log(this.emoji);
      for (let i in this.emoji) {
        if (this.emoji[i] == item){
          console.log(i);
          this.$refs.sendtext.value = this.$refs.sendtext.value + '' + i;
          this.showEmojis = false;
          console.log(this.$refs.sendtext.value);
        }
        // console.log(this.emoji[i] ,i);
      }
    },
    closebox() {
        this.showEmojis = false;
    },
    transEmojiText(mess) { // 文本消息，emoji 消息区分
      //分离转化emoji 文本消息
      // var data = aEmoji.map;
      console.log(mess);
      var emojiMess = this.replaceEmoji(mess);
      return emojiMess;
    },
    replaceEmoji(content) {
      for (var key in this.emoji) {
        if (this.emoji.hasOwnProperty(key)) {
          content = this.replaceM(content, key);
        }
      }
      return content;
    },
    replaceM(content, i) {
      if (content.indexOf(i) > -1) {
        content = content.replace(i, '<img class="emojis" src="images/faces/' + this.emoji[i] + '" /></li>');
        if (content.indexOf(i) > -1) {
          content = this.replaceM(content, i);
        }
      }
      return content;
    },
    /**********************OSS校验信息******************************/
    getddApi() {
      var now = null,
        timestamps = null;
        var _this = this;
      $.ajax({
        type: 'GET',
        url: 'https://www.pcddapi.net/api/v0/system/getOssInfo.api',
        success: function (data) {
            // console.log('获取到的数据为：', data);
            var osData = data;
            _this.oss.accessid = osData.ossAccessid;
            _this.oss.host = osData.ossHost;
            _this.oss.okey = osData.ossKey;
            _this.oss.pbase64 = osData.policyBase64;
            _this.oss.signature = osData.signature;

            // 获取到消息后的处理 
            now = timestamps = Date.parse(new Date()) / 1000;
            var policyText = {
              "expiration": "2020-01-01T12:00:00.000Z", //设置该Policy的失效时间，超过这个失效时间之后，就没有办法通过这个policy上传文件了
              "conditions": [
                ["content-length-range", 0, 1048576000] // 设置上传文件的大小限制
              ]
            };
            // 
            // var policyBase64 = Base64.encode(JSON.stringify(policyText));
            var message = _this.oss.pbase64;
            var bytes = Crypto.HMAC(Crypto.SHA1, message, _this.oss.accessid, {
              asBytes: true
            });
            // var signature = Crypto.util.bytesToBase64(bytes);
          }
      })
    },
    uploadFiles (file, fileName) {
      var _this = this;
      var localUrl = this.dir + fileName;
      var request = new FormData();
      request.append("OSSAccessKeyId", this.oss.accessid);//Bucket 拥有者的Access Key Id。
      request.append("policy", this.oss.pbase64);//policy规定了请求的表单域的合法性
      request.append("Signature",  this.oss.signature);//根据Access Key Secret和policy计算的签名信息，OSS验证该签名信息从而验证该Post请求的合法性
      request.append("key", this.dir + fileName); //文件名字，可设置路径
      request.append("success_action_status",'200');// 让服务端返回200,不然，默认会返回204
      request.append('file', file);//需要上传的文件 file
      request.append('submit', "Upload to OSS");
      $.ajax({
        url: this.oss.host,
        type: 'POST',
        cache: false,
        data: request,
        processData: false,
        contentType: false,
        success:function (data) {
          console.log('上传成功', data, localUrl);
          var imageText = _this.oss.host + "/" + localUrl;
          _this.sendImgs(localUrl, function () {
            _this.play(imageText);
          })
        },
        error: function (err) {
          console.log(err);
        }
      });
    },
    sendPrivateImg() { // 上传图片 文件
      let _this = this;
      if (_this.accessid != '') {
        var file = document.getElementById('upload').files[0];
        var fileName = _this.getFileName(file.name);
        var reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function (e) {
          var buffer = this.result;
          var newB = _this.encrypt(buffer, _this.secretKey, _this.vi)
          var blob = new Blob([newB]);
          var newFile = new File([blob], fileName);
          console.log(newFile,fileName);
          // console.log('name',newFile);
          _this.uploadFiles(newFile, fileName);
        }
      }
    },
    getFileName(filename){ //获取文件的名称
      var suffix=this.get_suffix(filename);
      var name = this.random_string(10);
      if(suffix==".mp3"){ //音频
        name = name+".temp";
      }else{ //图片
        name= name+".text"
      }
      return name;
    },
    play(text){// 显示上传的图片
        var url = text;
        var suffix = null;
        var xmlhttp;
        var _this = this;
        if(window.XMLHttpRequest){// code for IE7+, Firefox, Chrome, Opera, Safari
            xmlhttp=new XMLHttpRequest();
        } else{// code for IE6, IE5
            xmlhttp=new ActiveXObject("Microsoft.XMLHTTP");
        }
        //onreadystatechange 存储函数（或函数名），每当 readyState 属性改变时，就会调用该函数。
        xmlhttp.onreadystatechange=function(){ 
            if (xmlhttp.readyState==4 && xmlhttp.status==200){
                // 消息上传成功
                var responseText = xmlhttp.responseText;
                var content = "";
                if(url.indexOf(".text") > 0){
                    suffix = _this.get_suffix(url);
                    var baseContent = _this.decrypt(responseText, _this.secretKey, _this.vi);
                    // console.log(url, suffix, baseContent, responseText, _this.secretKey, _this.vi);
                }
                
                // // 上传成功显示图片
                // var html = '';
                // html = '<div class="mess"><h4>' + _this.uname + ':</h4>' + "<img class='sendImg'   src=" + baseContent + ' />' + '</div>';
                // var box = $('#box');
                // box.append(html);
            }
        }
        xmlhttp.open("GET",url,true);
        xmlhttp.send();
        console.log('上传图片完成');
    },
    sendImgs(content, fn) {
      var _this = this;
      var cryNike = this.encrypt(this.uname, this.secretKey, this.vi);
      var aTimestamp = Date.parse(new Date());
      _this.uname = this.$refs.from.value;
      _this.toname = this.$refs.toname.value;
      var type = 0;
      if (content.indexOf(".text")>0) {
        type = 2
      } else {
        type = 3;
      }
      // 发送
      _this.socket.emit('onechat', {
        'from': _this.uname,
        'reciveId': _this.toname,
        'type': type,
        'msg': content
      });
      fn();
    },
    get_suffix(filename) { //文件的后缀？
      var pos = filename.lastIndexOf('.')
      suffix = ''
      if (pos != -1) {
        var suffix = filename.substring(pos)
      }
      return suffix;
    },
    random_string(len) { //随机生成文件名
      len = len || 32;
      var chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
      var maxPos = chars.length;
      var pwd = '';
      for (var i = 0; i < len; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * maxPos));
      }
      return pwd;
    },
    //DES 加密
    encrypt(plaintext, key, iv) {
      //加密
      var keyHex = CryptoJS.enc.Utf8.parse(key);
      var ivHex = CryptoJS.enc.Utf8.parse(iv);
      var encrypted = CryptoJS.TripleDES.encrypt(plaintext, keyHex, {
        iv: ivHex,
        //缺省为CBC
        mode: CryptoJS.mode.CBC,
        //缺省为Pkcs7
        padding: CryptoJS.pad.Pkcs7
      });
      var ciph = CryptoJS.enc.Base64.stringify(encrypted.ciphertext);
      return ciph;
    },
    //DES 解密
    decrypt (encrypttext, key, iv) {
      //解密
      var keyHex = CryptoJS.enc.Utf8.parse(key);
      var ivHex = CryptoJS.enc.Utf8.parse(iv);
      var decrypted = CryptoJS.TripleDES.decrypt({
          ciphertext: CryptoJS.enc.Base64.parse(encrypttext)
        },
        keyHex, {
          iv: ivHex,
          //缺省为CBC
          mode: CryptoJS.mode.CBC,
          //缺省为Pkcs7
          padding: CryptoJS.pad.Pkcs7
        }
      );
      var txt = decrypted.toString(CryptoJS.enc.Utf8);
      return txt;
    }
  }
})
