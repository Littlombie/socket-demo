//引入http模块
var socketio = require('socket.io'),
	http     = require('http'),
	domain   = require('domain'),
	redis    = require('redis'),
    //redisio  = require('socket.io-redis'),
    request  = require('request'),
    config   = require('./config.js');

var fs = require("fs");

var d = domain.create();
d.on("error", function(err) {
	console.log(err);
});
console.log('start');
//var numscount=0;// 在线人数统计
var sockets = {};
var chat_history={};
var chat_interval={};
var one_chat_history={};
var one_chat_interval={};
var secretKey = config['secretKey'];
var app_id = config['app_id'];
// redis 链接
var clientRedis  = redis.createClient(config['REDISPORT'],config['REDISHOST']);
clientRedis.auth(config['REDISPASS']);
var server = http.createServer(function(req, res) {
	res.writeHead(200, {
		'Content-type': 'text/html;charset=utf-8'
	});
    //res.write("人数: " + numscount );
	res.end();
}).listen(config['socket_port'], function() {
	//console.log('服务开启19965');
});

var io = socketio.listen(server,{
	pingTimeout: 60000,
  	pingInterval: 25000
});
/* var pub = redis.createClient(config['REDISPORT'], config['REDISHOST'], { auth_pass: config['REDISPASS'] });
var sub = redis.createClient(config['REDISPORT'], config['REDISHOST'], { auth_pass: config['REDISPASS'] });
io.adapter(redisio({ pubClient: pub, subClient: sub })); */
//setInterval(function(){
  //global.gc();
  //console.log('GC done')
//}, 1000*30); 

//如果日志目录不存在，则创建目录
var logs_path = config['logs_file'];
if(! fs.existsSync(logs_path)){
    fs.mkdirSync(logs_path);
}
//异常捕捉
process.on('uncaughtException', function (err) {
	//打印出错误
	//console.log(err.time);
    //./logs/error_2018-01-17.log
    var logfile = logs_path + '/error_' + FormatNowDate(1) + '.log';
    var error = "[ " + FormatNowDate(2) + " ]  " + err.stack + " \n";
	fs.appendFile(logfile, error, function () {
	  console.log('错误打印');
	});
	
	//打印出错误的调用栈方便调试
    //console.log(err.stack);
	console.log(error);
});

io.on('connection', function(socket) {
	console.log('连接成功 --', socket.id);
							
	var interval;
	
	socket.on('hi',function(data, callback){
		console.log(data);
		console.log('hi');
        io.emit('hi',data);
		//callback(1);
    });
	

	socket.on('conn',function(data){
		var dataObj  = typeof data == 'object'?data:evalJson(data);
        if(! dataObj || ! dataObj.from || !dataObj.signature){
			console.log('数据格式错误或from不存在');
			return;
		}
        //console.log(dataObj);
        if(check_name(dataObj.from + secretKey, dataObj.signature) == 0){
            console.log(dataObj.from + ' socketid: ' + socket.id + ' 验证失败');
			
            //console.log('验证失败===');
            throw new Error('验证失败： '+dataObj.from+'--'+dataObj.signature);
			return;
        }
		
		//开始初始化,控制台打印
		var data_str = dataObj.from + " socketid: " + socket.id +" 开始加入组聊 ";
		console.log(data_str);
		
		var userid=dataObj.from;
        userid = app_id + userid;
		var group=dataObj.group;
        group = app_id + group;
		//查看当前用户是否有链接记录
		var old_socket = sockets[userid];
		if (old_socket && old_socket.id != socket.id) {
			//如果旧的socket与新socket不同,则释放旧的socket
			console.log(old_socket.uid + " socketid: " + old_socket.id + ' 旧链接断开');
			//发送断线消息
			old_socket.emit('otherLogin', 1);
            old_socket.isPrev = 1;
			old_socket.disconnect();
            clientRedis.hset('user_info', userid, 0);
		}
        
        if(userid && group){
            clientRedis.hget('user_info', userid, function(error,res){
				if(error){
					console.log('error');
					return;
				}else if(res==null || res==0){
					// 加入新组
					console.log(userid + ' socketid: ' + socket.id + ' 加入 ' + group);
					clientRedis.hset('user_info', userid, group);
					clientRedis.hset('user_socket', userid, socket.id);
					socket.join(group);
					
					socket.uid = userid;
					socket.isPrev = 0;
					sockets[userid] = socket;
				}else{
					// 分组修改
					if(res != group){
						//离开旧组，进入新组
						socket.leave(res);
						console.log(userid + ' socketid: ' + socket.id + ' 离开 ' + res);
						
						clientRedis.hset('user_info', userid, group);
						socket.join(group);
						console.log(userid + ' socketid: ' + socket.id + ' 加入 ' + group);
					}else{
						socket.join(group);
						console.log(userid + ' socketid: ' + socket.id + ' 两次加组相同');
					}
					clientRedis.hset('user_socket', userid, socket.id);
					socket.uid = userid;
					socket.isPrev = 0;
					sockets[userid] = socket;
				}
            });
        }
	});
	socket.on('addUser',function(data){
		var dataObj  = typeof data == 'object'?data:evalJson(data);
		//判断传输值是否存在
		if(! dataObj || ! dataObj.from || !dataObj.signature){
			console.log('数据格式错误或from不存在');
			return;
		}
        if(check_name(dataObj.from+secretKey, dataObj.signature) == 0){
            console.log(dataObj.from + ' socketid: ' + socket.id + ' 验证失败');
            throw new Error('验证失败： '+dataObj.from+'--'+dataObj.signature);
			return;
        }
		
		//控制台打印
		data_str = dataObj.from + " socketid: " + socket.id +" 开始addUser";
		console.log(data_str);
		
		var userid=dataObj.from;
        userid = app_id + userid;
		var old_socket = sockets[userid];
		if (old_socket && old_socket.id != socket.id) {
			//如果旧socket存在,则断开链接
			console.log(old_socket.uid + " socketid: " + old_socket.id + ' 旧链接断开');
			//发送断线消息
			old_socket.emit('otherLogin', 1);
            old_socket.isPrev = 1;
			old_socket.disconnect();
            clientRedis.hset('user_info', userid, 0);
		}
        
		//socket.uid = userid;
        if(userid){
            clientRedis.hget('user_info', userid, function(error,res){
                 if(error){
                    console.log('error');
					return;
                 }else if(res==null){
                    // 新人加入
                    console.log(userid + " socketid: " + socket.id +" addUser");
                    clientRedis.hset('user_info', userid, 0);
					clientRedis.hset('user_socket', userid, socket.id);
					socket.uid = userid;
					socket.isPrev = 0;
					sockets[userid] = socket;
                 }else{
					//consol
					clientRedis.hset('user_socket', userid, socket.id);
					socket.uid = userid;
					socket.isPrev = 0;
					sockets[userid] = socket;
                 }
            });
        }
    });
	socket.on('onechat',function(data){
		var dataObj  = typeof data == 'object'?data:evalJson(data);
		//判断传输值是否存在
		if(! dataObj || ! dataObj.reciveId){
			console.log('数据格式错误或reciveId不存在');
			return;
		}
		var uid = dataObj.from;
        uid = app_id + uid;
        //var uid = socket.uid;
        clientRedis.hget('user_socket', uid, function(error,res){
            if(error){
                console.log('error');
                throw new Error(error);
             }else if(res==null){
                // 新人加入
                console.log(uid + " socketid: " + socket.id + ' 没有addUser');
             }else{
                if(res!=socket.id){
                    console.log('socketid 不符');
                    return;
                }
                clientRedis.hget('user_info', uid, function(error,res){
                    if(error){
                        console.log('error');
                        throw new Error(error);
                     }else if(res==null){
                        // 新人加入
                        console.log(uid + " socketid: " + socket.id + ' 没有addUser');
                     }else{
                        var touid = dataObj.reciveId;
                        touid = app_id + touid;
                        //var uid = dataObj.from;
                        console.log(uid + " socketid: " + socket.id + ' 单聊 '+touid);
                        //查看目标socket是否存在
                        var tosocket = sockets[touid];
                        if(tosocket){
                            //目标id存在,则发送信息
                            one_process_msg(io, tosocket.id, data);
                        }else{
                            console.log('目标 ' + touid + ' 没有addUser');
                        }
                        // 给本人发消息
                        one_process_msg(io, socket.id, data);
                     }
                });
             }
        });
	});
	
	socket.on('groupchat',function(data){
		//console.log(data);
		console.log(socket.uid  + " socketid: " + socket.id + ' 开始组聊 ');
		var dataObj  = typeof data == 'object'?data:evalJson(data);
		if(! dataObj || ! dataObj.reciveId){
			console.log('数据格式错误或reciveId不存在');
			return;
		}
		var uid = dataObj.from;
        uid = app_id + uid;
        //var uid = socket.uid;
        //查看是否addUser
        clientRedis.hget('user_socket', uid, function(error,res){
            if(error){
                console.log('error');
                throw new Error(error);
             }else if(res==null){
                // 新人加入
                console.log(uid + " socketid: " + socket.id + ' 没有addUser');
             }else{
                if(res!=socket.id){
                    console.log('socketid 不符');
                    return;
                }
                clientRedis.hget('user_info', uid, function(error,res){
                    if(error){
                        //return;
                        console.log('error', error);
                        throw new Error(error);
                    }else if(res==null){
                        //没有adduser
                        console.log(uid + " socketid: " + socket.id + ' 没有adduser');
                    }else{ 
                        // 获取用户id
                        var group = res;
                        if(group != 0){
                            console.log(uid + " socketid: " + socket.id + ' 组聊 ' + group);
                            clientRedis.hget('gag_list', 'uid_'+uid, function(error,res){
                                // 记录是否被禁言
                                var notGag = 1;
                                if(error){
                                    //console.log('error', error);
                                    throw new Error(error);
                                    return;
                                }else if(res==null){
                                    //没有在禁言列表
                                    console.log(uid + " socketid: " + socket.id + ' 没有在禁言列表');
                                }else{
                                    if(res){
                                        //被禁言
                                        console.log(uid + " socketid: " + socket.id + ' 被禁言');
                                        notGag = 0;
                                    }
                                }
                                // 没有被禁言，发送消息
                                if(notGag){
                                    process_msg(io, group, data);
                                }else{
                                    //socket.emit('isGag','你被禁言了');
                                }
                            });
                        }else{
                            console.log(socket.uid + " socketid: " + socket.id + ' 没有加组');
                        }
                    }        
                });
            }        
        });
	});
	
	//禁言
	socket.on('gag',function(data){
		console.log(socket.uid  + " socketid: " + socket.id + ' 禁言/解禁 ');
		var dataObj  = typeof data == 'object'?data:evalJson(data);
		if(! dataObj || ! dataObj.gagId || ! dataObj.isGag){
			console.log('数据格式错误或gagId不存在');
			//socket.emit('error', 1001);
			return;
		}
		var gagId = dataObj.gagId;
        gagId = app_id + gagId;
		var isGag = dataObj.isGag;
        clientRedis.hget('gag_list','uid_'+gagId,function(error,res){
            var gag_lists = {};
            if(error){
                //return;
                console.log('error', error);
                throw new Error(error);
                //socket.emit('error', 1004);
            }else if(res==null){
                console.log(gagId + ' 禁言列表无此人');
                //没有禁言列表
                if(isGag==1){
                    var re = clientRedis.hset('gag_list', 'uid_'+gagId, 1);
                    console.log(re);
                    //callback('禁言成功');
                }
            }else{
                console.log(gagId + ' 禁言列表含有此人');
                if(isGag==2){
                    var re = clientRedis.hdel('gag_list', 'uid_'+gagId);
                    console.log(re);
                    //callback('解禁成功');
                }
            }
        });
	});
	//踢人
	socket.on('kick',function(data){
		console.log(socket.uid  + " socketid: " + socket.id + ' 踢人 ');
		var dataObj  = typeof data == 'object'?data:evalJson(data);
		if(! dataObj || ! dataObj.kickId){
			console.log('数据格式错误或kickId不存在');
			return;
		}
        var kickId = app_id + dataObj.kickId;
		//踢人
        clientRedis.hget('user_info', kickId, function(error,res){
            if(error){
                //return;
                console.log('error', error);
                throw new Error(error);
                //socket.emit('error', 1004);
            }else if(res==null){
                console.log(kickId  + ' 此人没有addUser');
            }else if(res==0){
                console.log(kickId  + ' 此人没有加组');
            }else{
                var kickSocket = sockets[kickId];
                if(kickSocket){
                    kickSocket.leave(res);
                    kickSocket.emit('kick', '你被请出房间，请稍后再次进入');
                }
                console.log(kickId + " socketid: " + kickSocket.id + ' 在 '+res+' 中，被踢出房间');

                //删除组信息
                clientRedis.hset('user_info',kickId, 0);
            }
        });
	});
	
	//查看用户房间
	socket.on('getRoom', function(data, callback) { 
		console.log(socket.uid  + " socketid: " + socket.id + ' 查看用户房间 ');
		var dataObj  = typeof data == 'object'?data:evalJson(data);
		if(! dataObj || ! dataObj.userName){
			console.log('数据格式错误或userName不存在');
			return;
		}
		var userName = app_id + dataObj.userName;
        clientRedis.hget('user_info', userName, function(error,res){
            var result = null;
            if(error){
                //return;
                console.log('error', error);
                throw new Error(error);
            }else if(res==null || res==0){
                console.log('此人没在任何组中');
            }else{
                result = res;
            }
            try{
                callback(result);
            }catch(e){
                console.log(e);
            }
        });
	});
	
	//查看socket是否存在
	socket.on('isLive',function(data, callback){
		console.log(socket.uid  + " socketid: " + socket.id + ' 检查 isLive ');
		var dataObj  = typeof data == 'object'?data:evalJson(data);
		if(! dataObj || ! dataObj.userName){
			console.log('数据格式错误或userName不存在');
			return;
		}
        var userName = app_id + dataObj.userName;
        var result = 0;
		//查看socket是否存在
		var uSocket = sockets[userName];
		if(uSocket){
            result = 1;
			console.log(userName + ' 在线');
		}else{
			console.log(userName + ' 不在线');
		}
        
		try{
			callback(result);
		}catch(e){
			console.log(e);
		}
	});	
	//查看socket是否存在
	socket.on('isOnline',function(data){
		console.log(socket.uid  + " socketid: " + socket.id + ' 检查 isOnline ');
		var dataObj  = typeof data == 'object'?data:evalJson(data);
		if(! dataObj || ! dataObj.userName){
			console.log('数据格式错误或userName不存在');
			return;
		}
        var userName = app_id + dataObj.userName;
        var result_obj = {"isLive": 0};
		var uSocket = sockets[userName];
		if(uSocket){
            result_obj.isLive = 1;
			console.log(userName + ' 在线');
		}else{
			console.log(userName + ' 不在线');
		}
        
        socket.emit('isOnline', JSON.stringify(result_obj));
	});
	
	//离开分组
	socket.on('leave', function(data, callback) { 
		var data_str = socket.uid  + " socketid: " + socket.id + " 准备离开组";
		console.log(data_str);
		var dataObj  = typeof data == 'object'?data:evalJson(data);
		if(! dataObj || ! dataObj.from){
			console.log('数据格式错误或from不存在');
			return;
		}
		
		var uid = socket.uid;
		//查询是否在组中
        clientRedis.hget('user_info', uid, function(error,res){
            if(error){
                //return;
                console.log('error', error);
                throw new Error(error);
                //socket.emit('error', 1004);
            }else if(res==null || res==0){
                console.log(uid  + " socketid: " + socket.id + ' 没在任何组中');
            }else{
                var group = res;
                clientRedis.hset('user_info', uid, 0);
                socket.leave(group);

                console.log(uid  + " socketid: " + socket.id + ' 离开组 ' + group);
            }
        });
	});
	
			
    //资源释放
	socket.on('disconnect', function(data) {
		var data_str = socket.uid  + " socketid: " + socket.id +" 断开socket ";
		if(socket.isPrev==1){
			data_str = socket.uid  + " socketid: " + socket.id +" 断开socket -- old-socket";
		}
		console.log(data_str);
		//io.emit('hi',2);
		
		var uid = socket.uid;
		
		if(uid){
			//查询是否addUser
			clientRedis.hget('user_info', uid, function(error,res){
				if(error){
					console.log('error', error);
					throw new Error(error);
				}else if(res==null){
					console.log(uid, '从 redis 没有获取到', 'socket.id: ', socket.id);
				}else{
					var group = res;
					if(group!=0){
						socket.leave(group);
						console.log(uid + ' socket.id: ' + socket.id + ' 离开组', group);
					}
					//非断线重连，redis删除数据，
					if(socket.isPrev==0){
						clientRedis.hdel('user_info', uid);
						clientRedis.hdel('user_socket', uid);
						//删除sockets对象内的数据
						sockets[uid] = null;
						delete sockets[uid];
					}
				}
			});
		}
        
		//删除 io.sockets.sockets 数据
		delete io.sockets.sockets[socket.id];
	});

});

function evalJson(data){
	//return eval("("+data+")");
	var obj = null;
	try {
		obj = eval("("+data+")");
	} catch(e) {
		obj = null;
		//json 解码
		console.log(e);
        throw new Error(e);
	}
	return obj;
}
/* 
 * md5验证
 * 
 */
function check_name(str, md5str){
    str = hex_md5(str);
    if(str==md5str){
        return 1;
    }else{
        return 0;
    }
}

function process_msg(io,roomnum,data){
	if(!chat_history[roomnum]){
		chat_history[roomnum]=[];
	}
	if(data){
		//数据存在则加入聊天记录,等待发送
		chat_history[roomnum].push(data);
	}
	
	//console.log('process_msg',data);
	chat_interval[roomnum] || (chat_interval[roomnum]=setInterval(function(){
		if(chat_history[roomnum].length>0){
			send_msg(io,roomnum);
			//console.log('send_msg1',data,roomnum);
		}else{
			clearInterval(chat_interval[roomnum]);
			chat_interval[roomnum]=null;
		}
	},200));
}
function send_msg(io,roomnum){
	var data=chat_history[roomnum].splice(0,chat_history[roomnum].length);
	if(data){
		//console.log('send_msg',roomnum);
		//逐条发送信息
		for(var i=0; i<data.length; i++){
			io.sockets.in(roomnum).emit("groupchat", data[i]);
		}
	}
}

function one_process_msg(io,touid,data){
	if(!one_chat_history[touid]){
		one_chat_history[touid]=[];
	}
	if(data){
		//数据存在则加入聊天记录,等待发送
		one_chat_history[touid].push(data);
	}
	
	one_chat_interval[touid] || (one_chat_interval[touid]=setInterval(function(){
		if(one_chat_history[touid].length>0){
			one_send_msg(io,touid);
		}else{
			clearInterval(one_chat_interval[touid]);
			one_chat_interval[touid]=null;
		}
	},200));
}

function one_send_msg(io,touid){
	var data=one_chat_history[touid].splice(0,one_chat_history[touid].length);
	if(data){
		//console.log(sockets[touid].id);
		//var toSocketId = sockets[touid].id;
		//console.log(io.sockets.sockets);
		//逐条发送信息
		for(var i=0; i<data.length; i++){
			io.sockets.sockets[touid].emit("onechat", data[i]);	
		}
	}
}

//时间格式化
function FormatNowDate(type=0){
	var mDate = new Date();
    if(type==0){
		var H = mDate.getHours();
		var i = mDate.getMinutes();
		var s = mDate.getSeconds();
        // 时:分:秒
        return add_0(H) + ':' + add_0(i) + ':' + add_0(s);
    }else if(type==1){
		var Y = mDate.getFullYear();
		var m = mDate.getMonth() + 1;
		var d = mDate.getDate();
        // 年-月-日
        return Y + '-' + add_0(m) + '-' + add_0(d);
    }else if(type==2){
		var H = mDate.getHours();
		var i = mDate.getMinutes();
		var s = mDate.getSeconds();
		var Y = mDate.getFullYear();
		var m = mDate.getMonth() + 1;
		var d = mDate.getDate();
        // 年-月-日 时:分:秒
		return Y + '-' + add_0(m) + '-' + add_0(d) + ' ' + add_0(H) + ':' + add_0(i) + ':' + add_0(s);
	}
}
//数字不足 10,前面添加 0
function add_0(num){
    if(num<10){
        return '0' + num;
    }else{
        return num;
    }
}
var hexcase = 0;  /* hex output format. 0 - lowercase; 1 - uppercase        */
var b64pad  = ""; /* base-64 pad character. "=" for strict RFC compliance   */
var chrsz   = 8;  /* bits per input character. 8 - ASCII; 16 - Unicode      */

function hex_md5(s){ return binl2hex(core_md5(str2binl(s), s.length * chrsz));}
/*
 * Calculate the MD5 of an array of little-endian words, and a bit length
 */
function core_md5(x, len)
{
  /* append padding */
  x[len >> 5] |= 0x80 << ((len) % 32);
  x[(((len + 64) >>> 9) << 4) + 14] = len;

  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;

    a = md5_ff(a, b, c, d, x[i+ 0], 7 , -680876936);
    d = md5_ff(d, a, b, c, x[i+ 1], 12, -389564586);
    c = md5_ff(c, d, a, b, x[i+ 2], 17,  606105819);
    b = md5_ff(b, c, d, a, x[i+ 3], 22, -1044525330);
    a = md5_ff(a, b, c, d, x[i+ 4], 7 , -176418897);
    d = md5_ff(d, a, b, c, x[i+ 5], 12,  1200080426);
    c = md5_ff(c, d, a, b, x[i+ 6], 17, -1473231341);
    b = md5_ff(b, c, d, a, x[i+ 7], 22, -45705983);
    a = md5_ff(a, b, c, d, x[i+ 8], 7 ,  1770035416);
    d = md5_ff(d, a, b, c, x[i+ 9], 12, -1958414417);
    c = md5_ff(c, d, a, b, x[i+10], 17, -42063);
    b = md5_ff(b, c, d, a, x[i+11], 22, -1990404162);
    a = md5_ff(a, b, c, d, x[i+12], 7 ,  1804603682);
    d = md5_ff(d, a, b, c, x[i+13], 12, -40341101);
    c = md5_ff(c, d, a, b, x[i+14], 17, -1502002290);
    b = md5_ff(b, c, d, a, x[i+15], 22,  1236535329);

    a = md5_gg(a, b, c, d, x[i+ 1], 5 , -165796510);
    d = md5_gg(d, a, b, c, x[i+ 6], 9 , -1069501632);
    c = md5_gg(c, d, a, b, x[i+11], 14,  643717713);
    b = md5_gg(b, c, d, a, x[i+ 0], 20, -373897302);
    a = md5_gg(a, b, c, d, x[i+ 5], 5 , -701558691);
    d = md5_gg(d, a, b, c, x[i+10], 9 ,  38016083);
    c = md5_gg(c, d, a, b, x[i+15], 14, -660478335);
    b = md5_gg(b, c, d, a, x[i+ 4], 20, -405537848);
    a = md5_gg(a, b, c, d, x[i+ 9], 5 ,  568446438);
    d = md5_gg(d, a, b, c, x[i+14], 9 , -1019803690);
    c = md5_gg(c, d, a, b, x[i+ 3], 14, -187363961);
    b = md5_gg(b, c, d, a, x[i+ 8], 20,  1163531501);
    a = md5_gg(a, b, c, d, x[i+13], 5 , -1444681467);
    d = md5_gg(d, a, b, c, x[i+ 2], 9 , -51403784);
    c = md5_gg(c, d, a, b, x[i+ 7], 14,  1735328473);
    b = md5_gg(b, c, d, a, x[i+12], 20, -1926607734);

    a = md5_hh(a, b, c, d, x[i+ 5], 4 , -378558);
    d = md5_hh(d, a, b, c, x[i+ 8], 11, -2022574463);
    c = md5_hh(c, d, a, b, x[i+11], 16,  1839030562);
    b = md5_hh(b, c, d, a, x[i+14], 23, -35309556);
    a = md5_hh(a, b, c, d, x[i+ 1], 4 , -1530992060);
    d = md5_hh(d, a, b, c, x[i+ 4], 11,  1272893353);
    c = md5_hh(c, d, a, b, x[i+ 7], 16, -155497632);
    b = md5_hh(b, c, d, a, x[i+10], 23, -1094730640);
    a = md5_hh(a, b, c, d, x[i+13], 4 ,  681279174);
    d = md5_hh(d, a, b, c, x[i+ 0], 11, -358537222);
    c = md5_hh(c, d, a, b, x[i+ 3], 16, -722521979);
    b = md5_hh(b, c, d, a, x[i+ 6], 23,  76029189);
    a = md5_hh(a, b, c, d, x[i+ 9], 4 , -640364487);
    d = md5_hh(d, a, b, c, x[i+12], 11, -421815835);
    c = md5_hh(c, d, a, b, x[i+15], 16,  530742520);
    b = md5_hh(b, c, d, a, x[i+ 2], 23, -995338651);

    a = md5_ii(a, b, c, d, x[i+ 0], 6 , -198630844);
    d = md5_ii(d, a, b, c, x[i+ 7], 10,  1126891415);
    c = md5_ii(c, d, a, b, x[i+14], 15, -1416354905);
    b = md5_ii(b, c, d, a, x[i+ 5], 21, -57434055);
    a = md5_ii(a, b, c, d, x[i+12], 6 ,  1700485571);
    d = md5_ii(d, a, b, c, x[i+ 3], 10, -1894986606);
    c = md5_ii(c, d, a, b, x[i+10], 15, -1051523);
    b = md5_ii(b, c, d, a, x[i+ 1], 21, -2054922799);
    a = md5_ii(a, b, c, d, x[i+ 8], 6 ,  1873313359);
    d = md5_ii(d, a, b, c, x[i+15], 10, -30611744);
    c = md5_ii(c, d, a, b, x[i+ 6], 15, -1560198380);
    b = md5_ii(b, c, d, a, x[i+13], 21,  1309151649);
    a = md5_ii(a, b, c, d, x[i+ 4], 6 , -145523070);
    d = md5_ii(d, a, b, c, x[i+11], 10, -1120210379);
    c = md5_ii(c, d, a, b, x[i+ 2], 15,  718787259);
    b = md5_ii(b, c, d, a, x[i+ 9], 21, -343485551);

    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
  }
  return Array(a, b, c, d);

}
/*
 * Convert an array of little-endian words to a hex string.
 */
function binl2hex(binarray)
{
  var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
  var str = "";
  for(var i = 0; i < binarray.length * 4; i++)
  {
    str += hex_tab.charAt((binarray[i>>2] >> ((i%4)*8+4)) & 0xF) +
           hex_tab.charAt((binarray[i>>2] >> ((i%4)*8  )) & 0xF);
  }
  return str;
}
/*
 * Convert a string to an array of little-endian words
 * If chrsz is ASCII, characters >255 have their hi-byte silently ignored.
 */
function str2binl(str)
{
  var bin = Array();
  var mask = (1 << chrsz) - 1;
  for(var i = 0; i < str.length * chrsz; i += chrsz)
    bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (i%32);
  return bin;
}
/*
 * These functions implement the four basic operations the algorithm uses.
 */
function md5_cmn(q, a, b, x, s, t)
{
  return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s),b);
}
function md5_ff(a, b, c, d, x, s, t)
{
  return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
}
function md5_gg(a, b, c, d, x, s, t)
{
  return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
}
function md5_hh(a, b, c, d, x, s, t)
{
  return md5_cmn(b ^ c ^ d, a, b, x, s, t);
}
function md5_ii(a, b, c, d, x, s, t)
{
  return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
function safe_add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}
/*
 * Bitwise rotate a 32-bit number to the left.
 */
function bit_rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt));
}
