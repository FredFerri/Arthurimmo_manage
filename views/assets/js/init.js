

// Connexion à socket.io
var socket = io.connect('http://###.##.#.##:8080');

var $window = $(window);
var nav = $('.fixed-button');
    $window.scroll(function(){
        if ($window.scrollTop() >= 200) {
         nav.addClass('active');
     }
     else {
         nav.removeClass('active');
     }
 });

// Réindex un array
function array_values(array) {
	var tmpArr = [];
	var key = '';
	for (key in array) {
		if (array[key] !== null) {
			tmpArr[tmpArr.length] = array[key];
		}
	}
	return tmpArr;
}

function initializeMap() {
	var mapOptions = {
        zoom: iZoomDefault,
        center: oLatLngDefault,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        scaleControl: true,
		zoomControl: true
    };
	map = new google.maps.Map(document.getElementById('gmap'), mapOptions);

	$('#gmap').css('width', 'calc(100% - 500px)');
	var screenHeight = $(window).height();
	var calcHeight = screenHeight - 80;
    $('#gmap').css('height', calcHeight);

}

// Affiche les markers situant les différentes agences
function displayMarkers(agences) {
		for (var i=0; i<agences.length; i++) {
			var agence = agences[i];
			var id_agence = agence.id_agence;
			var pinColor = agence.code_couleur.substring(1);

			var pinImage = new google.maps.MarkerImage("http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=%E2%80%A2|" + pinColor,
			new google.maps.Size(21, 34),
			new google.maps.Point(0,0),
			new google.maps.Point(10, 34));

			var myLatLng = new google.maps.LatLng(agence.y_latitude, agence.x_longitude);
			var beachMarker = new google.maps.Marker({
				position: myLatLng,
				map: map,
				icon: pinImage,
				title: agence.departement + ' - ' + agence.ville + ' - ' + agence.libelle + ' - Tél: ' + agence.tel
			});
            (function (id_agence) {
                beachMarker.addListener('click', function () {
                    selectAgence(id_agence);
                });
            })(id_agence);
			agences[i].marker = beachMarker;
		}
}

// Suppression des markers sur la map
function suppressionOverlay(){
	for(var polygone in tabPolygones){
		if (tabPolygones.hasOwnProperty(polygone)) {
			tabPolygones[polygone].setMap(null);
		}
	}
	tabPolygones = new Array();
	tabSelections = new Array();
}

function displayAllPolygones(datas, agence_id) {

	suppressionOverlay();


	var agence = datas.agence[0];
	var oLatLng = new google.maps.LatLng(agence.y_latitude, agence.x_longitude)
	map.setCenter(oLatLng);
	map.setZoom(13);

	for (var i=0; i<datas.zone.length; i++) {
        var zone = datas.zone[i];
        console.log('OK');

        var polygone = zone.polygone;
        polygone = polygone.substr(1);
        polygone = polygone.substr(0, polygone.length - 1);

        var tabMultiPoly = polygone.split('),(');
        var tabGeom = new Array();
        for(var curPoly=0; curPoly<tabMultiPoly.length; curPoly++){
            var tabPoints = tabMultiPoly[curPoly].split(',');
            var tabSousGeom = new Array();
            for(var j=0; j<tabPoints.length; j++){
                var coord = tabPoints[j].split(' ');
                tabSousGeom.push(new google.maps.LatLng(coord[1], coord[0]));
            }
            // pourquoi le test : si le nombre de sous-poly est à 1 on va sortir directement de la boucle donc tabSousGeom equivaut à tabGeom donc affectation
            if(tabMultiPoly.length>1) {
                tabGeom.push(tabSousGeom);
            }else{
                tabGeom=tabSousGeom;
            }
        }

		var oPolygone = new google.maps.Polygon({paths: tabGeom, strokeColor:'#FF0000', strokeOpacity:1, fillColor:zone.couleur, fillOpacity:0.5, visible: false});
		oPolygone.id_agence = zone.id_agence;
		oPolygone.couleur_origine = zone.couleur;
		oPolygone.id_polygone = zone.id_polygone;
		oPolygone.nom_agence = zone.lib_agence;
		oPolygone.nom_comm = zone.lib_commune;
		oPolygone.nom_poly = zone.lib_polygone;
		oPolygone.cp = zone.cp;
		oPolygone.hab = zone.val_nb_hab;
		oPolygone.hlm = zone.stat_pct_hlm;
		oPolygone.title = zone.lib_polygone+' - '+zone.lib_commune+' - '+zone.cp;
		oPolygone.setMap(map);
		oPolygone.setVisible(true);

		var marker = new MarkerWithLabel({
		position: new google.maps.LatLng(zone.centroide_y, zone.centroide_x),
		draggable: false,
		raiseOnDrag: false,
		map: map,
		labelAnchor: new google.maps.Point(0, 50),
		labelClass: "labels",
		labelStyle: {opacity: 1.0},
		icon: "images/1x1.gif",
		visible: false,
        labelContent: zone.lib_polygone+'<br />'+zone.lib_commune+'<br />'+zone.val_nb_hab+' habitants<br />'+zone.stat_pct_hlm+' d\'HLM'
        });

		oPolygone.oLabelMarker = marker;

		tabPolygones[oPolygone.id_polygone] = oPolygone;

		if (session_mode != 'logged_visitor') {
            assignationPoly(oPolygone);
        }

		displayInfosPoly(oPolygone);
	}

}


function assignationPoly(oPolygone) {
	google.maps.event.addListener(oPolygone, 'click', function(event) {
		preparePoly(oPolygone);
	});
	google.maps.event.addListener(oPolygone, 'rightclick', function(event) {
		cancelClick(oPolygone);
	});
}

// Affiche les infos du poly au survol
function displayInfosPoly(polygone) {
	google.maps.event.addListener(polygone, "mousemove", function(event) {
		polygone.oLabelMarker.setPosition(event.latLng);
		polygone.oLabelMarker.setVisible(true);
	});

	google.maps.event.addListener(polygone, "mouseout", function(event) {
		polygone.oLabelMarker.setVisible(false);
	});
}


// Chargement de l'autocompletion sur la barre de recherche d'adresse
function loadAutocomplete() {
    var pac_input = document.getElementById('agence_adresse');

    (function pacSelectFirst(input){
        // store the original event binding function
        var _addEventListener = (input.addEventListener) ? input.addEventListener : input.attachEvent;

        function addEventListenerWrapper(type, listener) {
            // Simulate a 'down arrow' keypress on hitting 'return' when no pac suggestion is selected,
            // and then trigger the original listener.

            if (type == "keydown") {
                var orig_listener = listener;
                listener = function (event) {
                    var suggestion_selected = $(".pac-item-selected").length > 0;
                    if (event.which == 13 && !suggestion_selected) {
                        var simulated_downarrow = $.Event("keydown", {keyCode:40, which:40})
                        orig_listener.apply(input, [simulated_downarrow]);
                    }

                    orig_listener.apply(input, [event]);
                };
            }

            // add the modified listener
            _addEventListener.apply(input, [type, listener]);
        }

        if (input.addEventListener)
            input.addEventListener = addEventListenerWrapper;
        else if (input.attachEvent)
            input.attachEvent = addEventListenerWrapper;

    })(pac_input);
    initializeAutocomplete();

    function initializeAutocomplete() {
        var autocomplete = new google.maps.places.Autocomplete(pac_input, { types: ['geocode'], componentRestrictions: {country: ["fr"]} });

        google.maps.event.addListener(autocomplete, 'place_changed', onPlaceChanged);

    }
}

// Chargement de l'autocompletion sur la barre de recherche d'adresse du formulaire d'édition
function loadAutocompleteEdition() {
    var pac_input = document.getElementById('edit_agence_adresse');

    (function pacSelectFirst(input){
        // store the original event binding function
        var _addEventListener = (input.addEventListener) ? input.addEventListener : input.attachEvent;

        function addEventListenerWrapper(type, listener) {
            // Simulate a 'down arrow' keypress on hitting 'return' when no pac suggestion is selected,
            // and then trigger the original listener.

            if (type == "keydown") {
                var orig_listener = listener;
                listener = function (event) {
                    var suggestion_selected = $(".pac-item-selected").length > 0;
                    if (event.which == 13 && !suggestion_selected) {
                        var simulated_downarrow = $.Event("keydown", {keyCode:40, which:40})
                        orig_listener.apply(input, [simulated_downarrow]);
                    }

                    orig_listener.apply(input, [event]);
                };
            }

            // add the modified listener
            _addEventListener.apply(input, [type, listener]);
        }

        if (input.addEventListener)
            input.addEventListener = addEventListenerWrapper;
        else if (input.attachEvent)
            input.attachEvent = addEventListenerWrapper;

    })(pac_input);
    initializeAutocomplete();

    function initializeAutocomplete() {
        var autocomplete = new google.maps.places.Autocomplete(pac_input, { types: ['geocode'], componentRestrictions: {country: ["fr"]} });

        google.maps.event.addListener(autocomplete, 'place_changed', onPlaceChanged);

    }
}


function addAgence() {
    var name = $('#agence_name').val();
    var adresse = $('#agence_adresse').val();
    var ville = $('#agence_ville').val();
    var cp = $('#agence_cp').val();
    var tel = $('#agence_tel').val();
    var fax = $('#agence_fax').val();
    var mail = $('#agence_mail').val();
    var resp = $('#agence_resp').val();
    var color = $('#agence_color').val();
    if (color != '' && ville != '' && cp != '' && name != '') {
        $.post(
            '/add_agence',
            {
                name: name,
                adresse: adresse,
                ville: ville,
                cp: cp,
                lng: lng,
                lat: lat,
                tel: tel,
                fax: fax,
                mail: mail,
                resp: resp,
                color: color
            },
            function (data) {
                $('#add_agence_title + .close').trigger('click');
                $('#agence_confirmation_block').show();
                $('#add_agence_form').find(".form-control").val("");
                $('#add_agence_close').trigger('click');

                if (typeof data[0].id_agence === 'number' && data[0].id_agence.toString().length > 0) {
                    var id_new_agence = data[0].id_agence;
                    var name_new_agence = data[0].libelle;
                    var cp_new_agence = data[0].departement;
                    $('#agence_confirmation_block .sa-success').show();
                    $('#agence_confirmation').text('Agence enregistrée !');
                    var new_option = '<option value="' + id_new_agence + '">' + cp_new_agence + ' - ' + ville + ' - ' + name_new_agence + '</option>';
                    var new_edition_option = '<tr><th id="edit_agence_name_' + id_new_agence + '">' + cp_new_agence + ' - ' + ville + ' - ' + name_new_agence + '</th>' +
                        '<th><buttton id="btn_edit_' + id_new_agence + '" class="agence_edit_btn btn-comment" onclick="return preEditAgence(this)">Modifier</buttton></th>' +
                        '<th><buttton id="btn_delete_' + id_new_agence + '" class="agence_del_btn btn-comment" onclick="return preDeleteAgence(this)">Supprimer</buttton></th>' +
                        '</tr>';
                    $('#lst_agences').prepend(new_option);
                    $("#lst_agences").val($("#lst_agences option:first").val());
                    $('#edit_lst_agences tbody').prepend(new_edition_option);
                    socket.emit('selectAgence', id_new_agence);
                    agences.push(data[0]);
                    displayMarkers(agences);
                }
                else {
                    $('.error_message').show();
                    $('#agence_confirmation').text('Problème d\'enregistrement');
                }
                setTimeout(function () {
                    $('#agence_confirmation_block').hide('slow');
                    $('#agence_color').attr('readonly', false);
                    $('#agence_cp').attr('readonly', false);
                }, 2000);
            }
        );
        return false;
    }
}

// Modifications sur le modal lorsque l'adresse a été validé
function selectAdresse() {
    if ($('#agence_adresse').val() != '') {
        if ($('.agence_type[value="zone_potentielle"]').is(':checked')) {
            $('#agence_cp').val('ZP');
            $('#agence_cp').attr('readonly', true);
            $('#agence_color').val('#c9401e');
            $('#agence_color').attr('readonly', true);
			$('#add_agence_title').text('Créer une nouvelle zone potentielle (ZP)');
        }
        else if ($('.agence_type[value="zone_interdite"]').is(':checked')) {
            $('#agence_cp').val('ZI');
            $('#agence_cp').attr('readonly', true);
            $('#agence_color').val('#171414');
            $('#agence_color').attr('readonly', true);
			$('#add_agence_title').text('Créer une nouvelle zone interdite (ZI)');
        }
        else {
            $('#agence_cp').val(dpt);
            $('#agence_cp').attr('readonly', false);
            $('#agence_color').val('');
            $('#agence_color').attr('readonly', false);
			$('#add_agence_title').text('Créer une nouvelle agence');
        }
        $('#add_agence_form .radios').hide();
        $('#add_agence_modal').css('height', 'auto');
        $('.agence_infos_comps').show();
        $('#select_adresse').attr("id", "submit_agence");
        $('#agence_adresse').prop("readonly", true);
        $('#add_agence_close').on('click', formCancel);
        $('#add_agence_close').text('Retour');
        $('#select_adresse').attr('id', 'submit_agence');
        $('#submit_agence').prop('onclick', null).off('click');
        $('#submit_agence').on('click', addAgence);



    }
}

// Retour au modal de sélection d'adresse
function formCancel() {
    $('#add_agence_form .radios').show();
    $('.agence_infos_comps').hide();
    $('#agence_color').attr('readonly', false);
    $('#agence_cp').attr('readonly', false);
    $('#submit_agence').prop('onclick', null).off('click');
    $('#submit_agence').attr("id", "select_adresse");
    $('#select_adresse').on('click', selectAdresse);
    $('#add_agence_title').text('Entrez l\'adresse de la nouvelle agence');
    $('#agence_adresse').prop("readonly", false);
    $('#add_agence_close').prop('onclick', null).off('click');
    $('#add_agence_close').text('Annuler');
    $('#add_agence_form').prop('onclick', null).off('click');
    return false;
}

// Affichage du modal de confirmation de suppression
function preDeleteAgence(btn) {
    var id = $(btn).attr('id').substr(11);
    $('#agence_delete_modal').show();
    $('#agence_delete_modal .confirm').on('click', function () {
        deleteAgence(id);
    })

}

function deleteAgence(agence_id) {
	$.ajax({
		type: "DELETE",
		url: "/del_agence/"+agence_id,
		success: function (data) {
			if (data=="OK") {
				$('#edit_agence_name_'+agence_id).parent().remove();
				$('#lst_agences option[value='+agence_id+']').remove();
				deleteMarker(agence_id);
                displayMarkers(agences);
                suppressionOverlay();
                $('#agence_delete_modal').hide();
                resetMapZoom();
            }
        }
	})
}

function deleteMarker(id_item) {
    for (var i=0; i<agences.length; i++) {
        if (agences[i].id_agence == id_item) {
            agences[i].marker.setMap(null);
            agences.splice(i, 1);
            agences.sort();
            return false;
        }
    }
}

function closeDeleteModal() {
    $('#agence_delete_modal').hide();
}

// Affichage de la fenetre d'edition d'une agence
function preEditAgence(btn) {
    var id = $(btn).attr('id').substr(9);
	$.get(
		'/agence/'+id,
		function (data) {
            $('#edit_lst_agences').hide();
            $('#edit_agence_form #edit_agence_id').val(data[0].id_agence);
            $('#edit_agence_form #edit_agence_adresse').val(data[0].google_adresse);
            $('#edit_agence_form #edit_agence_ville').val(data[0].ville);
			$('#edit_agence_form #edit_agence_name').val(data[0].libelle);
			$('#edit_agence_form #edit_agence_cp').val(data[0].departement);
			$('#edit_agence_form #edit_agence_tel').val(data[0].tel);
			$('#edit_agence_form #edit_agence_fax').val(data[0].fax);
			$('#edit_agence_form #edit_agence_mail').val(data[0].mail);
			$('#edit_agence_form #edit_agence_resp').val(data[0].responsable_agence);
			$('#edit_agence_form #edit_agence_color').val(data[0].code_couleur);
            $('#edit_agence_form').show();
            $('#edit_agence_form > div').show();
            loadAutocompleteEdition();

            // On centre la carte sur l'agence sélectionnée
            var oLatLng = new google.maps.LatLng(data[0].y_latitude, data[0].x_longitude);
            map.setCenter(oLatLng);
            map.setZoom(13);
            lat = data[0].y_latitude;
            lng = data[0].x_longitude;
        }
	)
}

function editAgence() {
    var id = $('#edit_agence_id').val();
    var name = $('#edit_agence_name').val();
    var adresse = $('#edit_agence_adresse').val();
    var ville = $('#edit_agence_ville').val();
    var cp = $('#edit_agence_cp').val();
    var tel = $('#edit_agence_tel').val();
    var fax = $('#edit_agence_fax').val();
    var mail = $('#edit_agence_mail').val();
    var resp = $('#edit_agence_resp').val();
    var color = $('#edit_agence_color').val();
    $.post(
        '/edit_agence/',
        {
        	id : id,
            name : name,
            adresse : adresse,
            ville: ville,
            cp : cp,
            lng: lng,
            lat: lat,
            tel: tel,
            fax: fax,
            mail: mail,
            resp: resp,
            color: color
        },
		function (datas) {
			$('#edit_delete-Modal').hide('slow');
            $('#edit_confirmation_block').show('slow');
            $('#edit_confirmation_block .sa-success').show('slow');
            $('#edit_confirmation').text('Agence mise à jour !');
            $('#lst_agences option[value='+id+']').text(cp+' - '+ville+' - '+name);
            $('#edit_agence_name_'+id).text(cp+' - '+ville+' - '+name);
            setTimeout(function () {
                $('#edit_confirmation_block').hide('slow');
                $('#edit_delete-Modal').show('slow');
                $('#edit_agence_back_btn').trigger('click');
            }, 2000);
            resetMapZoom();
        }
	)
}

// Evenement au click sur le bouton "retour" dans la fenetre edition
$('#edit_agence_back_btn').click(function () {
    $('#edit_agence_form').hide();
    $('#edit_agence_form > div').hide();
    $('#edit_lst_agences').show();
});

// Recentre la map sur une vue globale de la France
function resetMapZoom() {
    map.setCenter(new google.maps.LatLng(46.52863469527167,2.43896484375));
    map.setZoom(6);
    displayMarkers(agences);
}

function validateEmail(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email.toLowerCase());
}

function sendMail() {
    var mail_adress = $('#form_email').val();
    var message = $('#form_message').val();
    if (mail_adress != '' && message != '' && validateEmail(mail_adress)) {
		$('#sendmail_submit').attr('disabled', true);
        $.post(
            '/sendmail',
            {
                email: mail_adress,
                message: message
            },
            function (response) {
                console.log(response);
                $('#response_message').text(response);
                $('#response_message').show();
                setTimeout(function () {
                    $('#response_message').hide('slow');
                    $('#sendmail_submit').attr('disabled', false);
                },2500);

            }
        );
    }
}



