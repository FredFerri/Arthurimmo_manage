var mysql = require('mysql');

var connection = mysql.createConnection({
	host : 'localhost',
	user : '',
	password : '',
	database : 'arthurimmo',
	insecureAuth: true
});

connection.connect(function(err) {
    if (err) throw err;
	console.log("Connected!");
});

module.exports = connection;
