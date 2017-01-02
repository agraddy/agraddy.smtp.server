var config = require('agraddy.config');
var events = require('events');
var net = require('net');
var stream = require('stream');

var mod = {};

var listener;
var server;

function createRequest() {
	var duplex = new stream.Duplex();
	duplex._content = '';
	duplex._read_index = 0;
	duplex._read_size = 100;

	duplex._read = function(size) {
		if(size) {
			duplex._read_size = size;
		}

		if((duplex._read_index * duplex._read_size) > duplex.length) {
			this.push(null);
		} else {
			this.push(duplex._content.slice(duplex._read_index, duplex._read_size));
			duplex._read_index++;
		}
	};

	duplex._write = function(chunk, encoding, callback) {
		duplex.content += chunk.toString();
		callback();
	};

	return duplex;
}

function createResponse(socket) {
	var response = {};

	response.accept = function() {
		response.write('250 Message received.');
	};

	response.reject = function(msg) {
		if(msg) {
			response.write('550 ' + msg);
		} else {
			response.write('550 Message rejected.');
		}
	};

	response.write = function(input) {
		if(socket.completed) {
			socket.write(input);
		} else {
			socket.emitter.on('completed', function() {
				socket.write(input);
			});
		}
	};

	return response;
}

function handleLine(socket, line) {
	var input = line;
	var header;
	var matches;
	var to;

	if(socket.state == 'command') {
		if(false) {
		} else if('data\r\n' == input.toLowerCase()) {
			socket.state = 'header';
			socket.write('354 Start mail input ending with <CRLF>.<CRLF>');
		} else if('helo' == input.slice(0, 4).toLowerCase()) {
			socket.write('250 OK');
		} else if('mail from:' == input.slice(0, 10).toLowerCase()) {
			matches = input.match(/<([^>]*)>/);
			// TODO: Need to check if sender is valid
			if(true) {
				socket.emitter = new events.EventEmitter();
				socket.completed = false;
				socket.req = createRequest();
				socket.req.from = matches[1];
				socket.req.headers = {};
				socket.req.rawHeaders = [];

				socket.res = createResponse(socket);

				socket.write('250 Sender <' + socket.req.from + '> OK');
			}
		} else if('quit\r\n' == input.toLowerCase()) {
			socket.write('221 Closing connection.');
			socket.end();
		} else if('rcpt to:' == input.slice(0, 8).toLowerCase()) {
			matches = input.match(/<([^>]*)>/);
			to = matches[1];
			if(config.smtp.accounts.indexOf(to) !== -1) {
				socket.req.to = to;

				socket.write('250 Recipient <' + socket.req.to + '> OK');
			} else {
				socket.write('550 Unknown recipient');
			}
		} else {
			socket.write('502 The command is not implemented.');
		}
	} else if(socket.state == 'header') {
		if(input == '\r\n') {
			socket.state = 'message';

			listener(socket.req, socket.res);
		} else {
			header = input.split(':');
			socket.req.rawHeaders.push(header[0]);
			socket.req.rawHeaders.push(header[1]);

			socket.req.headers[header[0].toLowerCase()] = header[1];
		}
	} else if(socket.state == 'message') {
		if(input == '.\r\n') {
			socket.req.end();
			socket.state = 'command';

			// Need to wait for res.accept(), res.reject(), or res.write()
			socket.completed = true;
			socket.emitter.emit('completed');
			//socket.write('250 Message received.');
		} else {
			socket.req.write(input);
		}
	}
}

mod.createServer = function(emailListener) {
	listener = emailListener;

	server = net.createServer(function(socket) {
		// set the state to stream when the DATA command is sent
		socket.state = 'command';

		console.log('SERVER CONNECT');

		socket.write('220 ' + config.smtp.fqdn);

		var store = '';
		socket.on('data', function(data) {
			console.log('SERVER RECEIVED: ' + data.toString().replace(/\r?\n/g, ''));

			var line;
			store += data.toString();

			while(store.indexOf('\r\n') !== -1) {
				line = store.slice(0, store.indexOf('\r\n') + 2);

				handleLine(socket, line);

				store = store.slice(line.length);
			}

			//handleCommand(socket, data);
		});
	});

	return server;
};

module.exports = mod;
