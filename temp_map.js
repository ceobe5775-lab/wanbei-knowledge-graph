var req={};	
var siteinfo = "https://feiyi.inhct.cn/h5/map/";
var seriesData =[];
var nameMap = {
	"郑州市": "郑州",
	"开封市": "开封",
	"洛阳市": "洛阳",
	"平顶山市": "平顶山",
	"安阳市": "安阳",
	"鹤壁市": "鹤壁",
	"新乡市": "新乡",
	"焦作市": "焦作",
	"濮阳市": "濮阳",
	"许昌市": "许昌",
	"漯河市": "漯河",
	"三门峡市": "三门峡",
	"南阳市": "南阳",
	"商丘市": "商丘",
	"信阳市": "信阳",
	"周口市": "周口",
	"驻马店市": "驻马店",
	"济源市": "济源"
};
var option = {
	title: {
		text: '',
		sublink:'',
		link:''
	},
	tooltip: {
		trigger: 'item',
		formatter: function (params) {
			if(params.value){
				return params.name+"\n"+ params.value+'家';
			}else{
				return params.name;
			}
		},
	},
	visualMap: {
		type: 'piecewise', // 类型为分段型
		top: "bottom",
		left: 10,
		splitNumber: 6,
		seriesIndex: [0],
		itemWidth: 20, // 每个图元的宽度
		itemGap: 2,    // 每两个图元之间的间隔距离，单位为px
		pieces: [      // 自定义每一段的范围，以及每一段的文字
			{ gte: 150, label: '150家以上', color: '#fab80e' }, // 不指定 max，表示 max 为无限大（Infinity）。
			{ gte: 120, lte: 150, label: '120-150家', color: '#c972ab' },
			{ gte: 90, lte: 120, label: '90-120家', color: '#e8904f' },
			{ gte: 60, lte: 90, label: '60-90家', color: '#e56c6c' },
			{ gte: 30, lte: 60, label: '30-60家', color: '#a375cd' },
			{ lte: 30, label: '30家以下', color: '#738bd0' }          // 不指定 min，表示 min 为无限大（-Infinity）。
		],
		textStyle: {
			color: '#333'
		}						
	},
	series: [
		{
			name: '中国',
			type: 'map',
			map: 'chinaMap',
			zoom:1,
			roam: true,
			label: {
				show: true,
				textStyle:{fontSize: 10,color:"#e7dfd1"},//省份标签字体颜色
				formatter: function (params) {
					if(params.value){
						return params.name+"\n"+ params.value+'家';
					}else{
						return params.name;
					}
				},
			},
			itemStyle: {
				normal: {
					borderWidth: .5,//区域边框宽度
					borderColor: '#fff',//区域边框颜色
					areaColor:"#49b0ec",//区域颜色
			
				},						
				emphasis: {
					borderWidth: .5,
					borderColor: '#fff',
					areaColor:"#49b0ec",
				}
			},
			data: [],
			// 自定义名称映射
			nameMap: nameMap
		}
	]
};
// 创建echarts实例对象
var mCharts = echarts.init(document.getElementById('mapContain'));
var url = jsonPath + api.box_list;
get(url, {}, function(d){
	getData(5);
	// 初始化获取中国地图数据
	getMap('henan','henan')
	$('#item').on('click',function(){
		if($(this).val()){
			req.item = $(this).val()
		}else{
			delete req.item
		}
		if(req.city){
			let area = cityMap[req.city];
			getData(6);
			getMap(area,'city');
		}else{
			getData(5);
			getMap('henan','henan');
		}			
	});
	$('#type').on('click',function(){
		if($(this).val()){
			req.type = $(this).val()
		}else{
			delete req.type
		}	
		if(req.city){
			let area = cityMap[req.city];
			getData(6);
			getMap(area,'city');
		}else{
			getData(5);
			getMap('henan','henan');
		}		
	})
	
	
	
	// 注册点击事件
	mCharts.on('click', function (params) {
		if(params.value){		
			let cityName = 	params.name + '市';
			let area = cityMap[cityName];
			let areaName = ''; 	 
			if(area){
				req.city = cityName;
				getData(6);			
				getMap(area,'city');			
			}else{
				if(params.value){
					var cityNames = encodeURI(encodeURI(params.name));
					var url = 'map_baidu.html?city='+cityNames;
					window.open(url,'_blank')
				}else{
					  alert("该区域没有数据~")
				}							
			}
		}else{
			alert("该区域没有数据~")
		}
	});

	// 返回上一级
	function onBack() {
		var area; 
		delete req.city;
		getData(5);
		getMap('henan','henan');
	}
	
	//获取省份数量
	function getData(n){
		var arr = [];
		var name ={};
		var names =[];
		for(var i =0;i<d.length;i++){
			if(req.item && d[i][1] != req.item) continue;
			if(req.type && d[i][2] != req.type) continue;
			if(req.city && d[i][5] != req.city ) continue;
			arr.push(d[i])					
		}
		for(var i=0;i<arr.length;i++){
			if(name[arr[i][n]]){
				name[arr[i][n]] = name[arr[i][n]]+1
			}else{
				name[arr[i][n]] = 1
			}
		}
		for(var key in name){
			var nameJson = {};
			if(key.length == 0) continue;
			if(n==5){
				var _key = key.replace('市','');
			}else{
				var _key = key
			}		
			nameJson.name = _key;
			nameJson.value = name[key];
			names.push(nameJson)
		}
		seriesData = names;
	}
	// 请求地图json数据
	function getMap(area,str) {
		var getUrl = '' ;
		if(str == 'henan'){
			getUrl = siteinfo + area + '.json' 		  
		}else if(str == 'city'){
			getUrl = siteinfo +'cities/'+ area +'.json'
		}else{
			return false
		}	
		
		$.get(getUrl, function (res) {
			// 注册地图的矢量数据
			echarts.registerMap('chinaMap', res)			
			option.series[0].data = seriesData
			mCharts.setOption(option,true)		 
		})
	}
	$('#backAll').click(function(){
		delete req.province;
		delete req.city;
		getData(4);
		getMap('china','china');
	})
	$('#back').click(function(){
		onBack();
	})
});
