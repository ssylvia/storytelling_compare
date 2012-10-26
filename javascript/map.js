  dojo.require("esri.map");
  dojo.require("esri.dijit.Legend");
  dojo.require("esri.dijit.Scalebar");
  dojo.require("esri.arcgis.utils");
  dojo.require("esri.IdentityManager");
  dojo.require("dijit.dijit"); // optimize: load dijit layer
  dojo.require("dijit.layout.BorderContainer");
  dojo.require("dijit.layout.ContentPane");
  dojo.require("dijit.layout.StackContainer");
  dojo.require("esri.tasks.query");
  dojo.requireLocalization("esriTemplate","template");
  
  
    var map, urlObject;
	var mapChange = false;
	var mapExtent;
	var firstMap = false;
	var mapsLoaded = 1;
	var i18n;
	 
     function initMap() {
      patchID();
      
	  i18n = dojo.i18n.getLocalization("esriTemplate","template");
	  
	  dojo.byId('loadText').innerHTML = i18n.viewer.loading.message;
	  dojo.byId('syncHead').innerHTML = i18n.viewer.sync.head;
	  dojo.byId('scale').innerHTML = i18n.viewer.sync.scale;
	  dojo.byId('location').innerHTML = i18n.viewer.sync.location;
	  dojo.byId('legText').innerHTML = i18n.viewer.toggles.legend;
	  dojo.byId('desText').innerHTML = i18n.viewer.toggles.description;
	  
      if(configOptions.geometryserviceurl && location.protocol === "https:"){
        configOptions.geometryserviceurl = configOptions.geometryserviceurl.replace('http:','https:');
      }
      esri.config.defaults.geometryService = new esri.tasks.GeometryService(configOptions.geometryserviceurl);  
      


      if(!configOptions.sharingurl){
        configOptions.sharingurl = location.protocol + '//' + location.host + "/sharing/content/items";
      }
      esri.arcgis.utils.arcgisUrl = configOptions.sharingurl;
       
      if(!configOptions.proxyurl){   
        configOptions.proxyurl = location.protocol + '//' + location.host + "/sharing/proxy";
      }

      esri.config.defaults.io.proxyUrl =  configOptions.proxyurl;

      esri.config.defaults.io.alwaysUseProxy = false;
      
      urlObject = esri.urlToObject(document.location.href);
      urlObject.query = urlObject.query || {};
	  
	  if(urlObject.query.title){
        configOptions.title = urlObject.query.title;
      }
      if(urlObject.query.subtitle){
        configOptions.title = urlObject.query.subtitle;
      }
      if(urlObject.query.webmap){
        if (dojo.isArray(urlObject.query.webmap) == false){
        	configOptions.webmaps[0].id = urlObject.query.webmap;
			configOptions.webmaps[1].id = urlObject.query.webmap;
		  }
		  else{
			dojo.forEach(urlObject.query.webmap,function(webmap,i){
			  configOptions.webmaps[i] = {"id": webmap};
			});
		  }     
      } 
      if(urlObject.query.bingMapsKey){
        configOptions.bingmapskey = urlObject.query.bingMapsKey;      
      }
 
 	  initMaps();
	  bannerSetup();
	  
      }
    
    
    function createMap(j){
	  
	  esriConfig.defaults.map.slider = { left:200 };


      var mapDeferred = esri.arcgis.utils.createMap(configOptions.webmaps[j].id, "mapDiv"+[j], {
        mapOptions: {
          slider: true,
          nav: false,
          wrapAround180: true,
		  extent: mapExtent
        },
        ignorePopups:false,
        bingMapsKey: configOptions.bingmapskey
      });

      mapDeferred.addCallback(function (response) {
		  
		dojo.byId("title"+[j]).innerHTML = response.itemInfo.item.title;
        dojo.byId("description"+[j]).innerHTML = response.itemInfo.item.description;
        
        eval("map"+[j]+" = response.map");

		dojo.connect(eval("map"+[j]),"onUpdateEnd",hideLoader);
		dojo.connect(eval("map"+[j]),"onExtentChange",syncMaps);
		dojo.connect(eval("map"+[j]),"onPanEnd",enableSyncing);
		dojo.connect(eval("map"+[j]),"onZoomEnd",enableSyncing);
		
        var layers = response.itemInfo.itemData.operationalLayers;
        if(eval("map"+[j]).loaded){
          initUI(layers,j);
		  $(".esriSimpleSlider").css("left",($(".map").width()-42));
		  $("#mapDiv1_zoom_slider").css("left",($("#mapDiv1").width()-42));
        }
        else{
          dojo.connect(eval("map"+[j]),"onLoad",function(){
            initUI(layers,j);
			$(".esriSimpleSlider").css("left",($(".map").width()-42));
			$("#mapDiv1_zoom_slider").css("left",($("#mapDiv1").width()-42));
          });
        }
       });

      mapDeferred.addErrback(function (error) {
          alert(i18n.viewer.errors.createMap + " " + dojo.toJson(error.message));
      });


    
    }

    function initUI(layers,j) {
      //add chrome theme for popup
      dojo.addClass(eval("map"+[j]).infoWindow.domNode, "chrome");
      //add the scalebar 
	  /*
      var scalebar = new esri.dijit.Scalebar({
        map: eval("map"+[j]),
        scalebarUnit:i18n.viewer.main.scaleBarUnits //metric or english
      });
	  */
      var layerInfo = buildLayersList(layers);      
      
      if(layerInfo.length > 0){
        var legendDijit = new esri.dijit.Legend({
          map:eval("map"+[j]),
          layerInfos:layerInfo
        },'legend'+[j]);
        legendDijit.startup();
      }
      else{
        dojo.byId('legend'+[j]).innerHTML = 'No Legend';
      }
	  
    }
function buildLayersList(layers){
        //layers  arg is  response.itemInfo.itemData.operationalLayers;
        var layerInfos = [];
        dojo.forEach(layers, function(mapLayer, index){
          var layerInfo = {};
          if (mapLayer.featureCollection && mapLayer.type !== "CSV") {
            if (mapLayer.featureCollection.showLegend === true) {
              dojo.forEach(mapLayer.featureCollection.layers, function(fcMapLayer){
                if (fcMapLayer.showLegend !== false) {
                  layerInfo = {
                    "layer": fcMapLayer.layerObject,
                    "title": mapLayer.title,
                    "defaultSymbol": false
                  };
                  if (mapLayer.featureCollection.layers.length > 1) {
                    layerInfo.title += " - " + fcMapLayer.layerDefinition.name;
                  }
                  layerInfos.push(layerInfo);
                }
              });
            }
          } else if (mapLayer.showLegend !== false) {
            layerInfo = {
              "layer": mapLayer.layerObject,
              "title": mapLayer.title,
              "defaultSymbol": false
            };
            //does it have layers too? If so check to see if showLegend is false
            if (mapLayer.layers) {
              var hideLayers = dojo.map(dojo.filter(mapLayer.layers, function(lyr){
                return (lyr.showLegend === false);
              }), function(lyr){
                return lyr.id
              });
              if (hideLayers.length) {
                layerInfo.hideLayers = hideLayers;
              }
            }
            layerInfos.push(layerInfo);
          }
        });
        return layerInfos;
      }

    
     function patchID() {  //patch id manager for use in apps.arcgis.com
       esri.id._isIdProvider = function(server, resource) {
       // server and resource are assumed one of portal domains
 
       var i = -1, j = -1;
 
       dojo.forEach(this._gwDomains, function(domain, idx) {
         if (i === -1 && domain.regex.test(server)) {
           i = idx;
         }
         if (j === -1 && domain.regex.test(resource)) {
           j = idx;
         }
       });
 
       var retVal = false;
   
       if (i > -1 && j > -1) {
         if (i === 0 || i === 4) {
           if (j === 0 || j === 4) {
             retVal = true;
           }
         }
         else if (i === 1) {
           if (j === 1 || j === 2) {
             retVal = true;
           }
         }
         else if (i === 2) {
           if (j === 2) {
             retVal = true;
           }
         }
         else if (i === 3) {
           if (j === 3) {
             retVal = true;
           }
         }
       }
 
       return retVal;
     };    
    }
	
	function setExtent(){
		if (configOptions.syncMaps == true){
			if (firstMap == false){
				mapExtent = map0.extent();
				firstMap = true;
			}
		}
	}
	
	function hideLoader(){
		if (mapsLoaded == configOptions.webmaps.length){
			$("#loadingCon").hide();
			if(configOptions.webmaps.length == 2){
				$("#mapDiv1_zoom_slider").show();
			}
		}
		else{
			mapsLoaded++
		}
		$(".esriSimpleSlider").css("left",($(".map").width()-42));
		$("#mapDiv1_zoom_slider").css("left",($("#mapDiv1").width()-42));
	}
	
	function resizeMaps(){
		if(map0 != null){
			map0.resize();
		}
		if(map1 != null){
			map1.resize();
		}
		if(map2 != null){
			map2.resize();
		}
	}
	
	$(window).resize(function(e) {
		resizeMaps();
    });