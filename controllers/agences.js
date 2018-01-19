var database = require('./database');
var mysql = require('mysql');

module.exports = {
	getAllAgences: function(callback) {
		var query = 'SELECT id_agence, ville, departement, libelle, x_longitude, y_latitude, code_couleur, tel';
		query += ' FROM agences';
		query += ' ORDER BY departement, libelle';
		database.query(query, function(err, rows) {
			if (err) {
				throw err;
			} 
			else {
				callback(null, rows);
			}
		});
	},
	
	getAgence: function(id, callback) {
		var query = 'SELECT id_agence, libelle, x_longitude, y_latitude';
		query += ' FROM agences';
		query += ' WHERE id_agence = ?';
		database.query(query, [id], function(err, agence) {
			if (err) {
				throw err;
			} 
			else {
				var centroide_x = agence[0].x_longitude;
				var centroide_y = agence[0].y_latitude;
				var distance = 40;
				
				var filtered_query = 'SELECT DISTINCT polygones.id_polygone';
				filtered_query += ' FROM agences, agence_polygone, polygones, communes';
				filtered_query += ' WHERE agences.id_agence = agence_polygone.id_agence';
				filtered_query += ' AND agence_polygone.id_polygone = polygones.id_polygone';
				filtered_query += ' AND polygones.id_commune_rattachement = communes.id_commune';
				filtered_query += ' AND get_distance_kilometres(' + mysql.escape(centroide_x) + ', ' + mysql.escape(centroide_y) + ', centroide_x, centroide_y) <= ' + mysql.escape(distance);

                var query = 'SELECT "poly" AS type, agences.id_agence AS id_agence, agences.libelle AS lib_agence, agences.code_couleur AS couleur, polygones.id_polygone AS id_polygone, polygones.libelle AS lib_polygone, polygones.centroide_x AS cX, polygones.centroide_y AS cY, polygone, communes.libelle AS lib_commune, communes.cp, filtered_stats.val_nb_hab, filtered_stats.stat_pct_hlm';
                query += ' FROM agences, agence_polygone, polygones, communes, filtered_stats';
                query += ' WHERE agences.id_agence = agence_polygone.id_agence';
				query += ' AND agence_polygone.id_polygone = polygones.id_polygone';
				query += ' AND polygones.id_commune_rattachement = communes.id_commune';
				query += ' AND polygones.id_polygone = filtered_stats.id_polygone';
				query += ' AND get_distance_kilometres(' + mysql.escape(centroide_x) + ', ' + mysql.escape(centroide_y) + ', centroide_x, centroide_y) <= ' + mysql.escape(distance);
				
				query += ' UNION ';
				
				query+='SELECT "poly" AS type, "0" AS id_agence, "none" AS lib_agence, "#FFFFFF" AS couleur, polygones.id_polygone AS id_polygone, polygones.libelle AS lib_polygone, polygones.centroide_x AS cX, polygones.centroide_y AS cY, polygone, communes.libelle AS lib_commune, communes.cp, filtered_stats.val_nb_hab, filtered_stats.stat_pct_hlm';
				query+=' FROM polygones, communes, filtered_stats';
				query+=' WHERE polygones.id_commune_rattachement = communes.id_commune';
				query+=' AND polygones.id_polygone = filtered_stats.id_polygone';
				query += ' AND get_distance_kilometres(' + mysql.escape(centroide_x) + ', ' + mysql.escape(centroide_y) + ', centroide_x, centroide_y) <= ' + mysql.escape(distance);
				query+=' AND polygones.id_polygone NOT IN ('+filtered_query+')';
				
				database.query(query, function(err, rows) {
					if (err) {
						throw err;
					}
					else {
						var datas = {};
						datas.agence = agence;
						datas.zone = rows;
						callback(null, datas);
					}
				});
			}
		});
	},

	getAgenceLight: function (id_agence, callback) {
		var query = 'SELECT * FROM agences WHERE id_agence=?';
		database.query(query, id_agence, function (err, datas) {
            if (err) {
                throw err;
            }
            else {
            	callback(null, datas);
			}
        })
    },

	editAgence: function (agence_infos, callback) {
        var agenceName = agence_infos.name;
        var agenceAdresse = agence_infos.adresse;
        var agenceVille = agence_infos.ville;
        var agenceCp = agence_infos.cp;
        var lng = agence_infos.lng;
        var lat = agence_infos.lat;
        var tel = agence_infos.tel;
        var fax = agence_infos.fax;
        var mail = agence_infos.mail;
        var resp = agence_infos.resp;
        var couleur = agence_infos.color;
        var id = agence_infos.id;
        var inserts = [agenceName, agenceVille, tel, fax, mail, lng, lat, agenceAdresse, agenceCp, couleur, resp];

		var query = 'UPDATE agences SET libelle = ?, ville = ?, tel = ?, fax = ?, mail = ?, x_longitude = ?, y_latitude = ?, ' +
			'google_adresse = ?, departement = ?, code_couleur = ?, responsable_agence = ? WHERE id_agence='+id;
		database.query(query, inserts, function (err, response) {
            if (err) throw err;
            callback(null, response);
        })
    },
	
	loadAgence: function(datas, id_agence, callback) {
		var selectedDatas = [];
		var zoneDatas = [];
		var datas = datas.zone;
		// Ici, on récupère tous les polygones se trouvant autour de l'agence en question, et on partage en 2 arrays:
		// selectedDatas = les polygones rattachés à l'agence
		// zoneDatas = les polygones étant dans la zone autour de l'agence mais n'étant pas attribués à l'agence
		for (var i=0; i<datas.length; i++) {
			if(datas[i].id_agence == id_agence){
				var subTab = [];
				var formatted_hlm = datas[i].stat_pct_hlm.substr(0, datas[i].stat_pct_hlm.indexOf('%'));
				formatted_hlm.trim();
				subTab.push(datas[i].cp, datas[i].lib_commune, datas[i].lib_polygone, datas[i].val_nb_hab, formatted_hlm, datas[i].id_polygone);
				selectedDatas.push(subTab);
			}
			else {
				var subTab2 = [];
                var formatted_hlm = datas[i].stat_pct_hlm.substr(0, datas[i].stat_pct_hlm.indexOf('%'));
                formatted_hlm.trim();
                subTab2.push(datas[i].cp, datas[i].lib_commune, datas[i].lib_polygone, datas[i].val_nb_hab, formatted_hlm, datas[i].id_polygone);
				zoneDatas.push(subTab2);
			}
		}
		callback(null, selectedDatas, zoneDatas);
	},
	
	updatePolygone: function(parameters, callback) {	
		var query = 'UPDATE agence_polygone SET id_agence = '+parameters.id_agence+' WHERE id_polygone = '+parameters.id_polygone;
		database.query(query, function(err, response) {
			if (err) throw err;
			callback(null, parameters);
		})
	},
	
	addAgence: function (agenceInfos, callback) {
		var agenceName = agenceInfos.name;
		var agenceAdresse = agenceInfos.adresse;
		var agenceVille = agenceInfos.ville;
		var agenceCp = agenceInfos.cp;
		var lng = agenceInfos.lng;
		var lat = agenceInfos.lat;
		var tel = agenceInfos.tel;
		var fax = agenceInfos.fax;
		var mail = agenceInfos.mail;
		var resp = agenceInfos.resp;
		var couleur = agenceInfos.color;
		var inserts = [agenceName, agenceAdresse, agenceVille, agenceCp, lng, lat, tel, fax, mail, resp, couleur];

		var query = "INSERT INTO agences(libelle, google_adresse, ville, departement, " +
			"x_longitude, y_latitude, tel, fax, mail, responsable_agence, code_couleur) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        database.query(query, inserts, function(err, rows) {
            if (err) {
                throw err;
            }
            else {
            	var query2 = "SELECT * FROM agences ORDER BY id_agence DESC LIMIT 1";
                database.query(query2, function(err, result) {
                	if (err) {
                		throw err;
                    }
                    else {
                        callback(null, result);
                    }
                })
            }
        })
    },
	
	deleteAgence: function (id_agence, callback) {
		var id = id_agence;
		var query = "DELETE FROM agences WHERE id_agence=?";
		database.query(query, id, function (err, result) {
			if (err) {
				throw err;
			}
			else {
				var query2 = "UPDATE agence_polygone SET id_agence=0 WHERE id_agence=?";
				database.query(query2, id, function (err, result2) {
					if (err) {
						throw err;
					}
					else {
                        var confirm = "OK";
                        callback(null, confirm);
					}
                })
			}
        })
    }
};