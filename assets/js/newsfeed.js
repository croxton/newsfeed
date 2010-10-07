/**
 * Newsfeed widget (newsfeed) - jQuery Plugin - source code
 *
 * @package		Newsfeed
 * @author  	Mark Croxton
 * @copyright	Copyright (c) 2008 Hallmark Design, http://www.hallmark-design.co.uk/
 * @version 	v1.05, 11.11.2009
 */

(function($) {
	
	// constructor
	$.fn.newsfeed = function(options) {
		
		/* private instance variables (inherited by all matched elements)
		-------------------------------------------------- */
		
		// options - inherit defaults if not set
		var opts = $.extend({}, $.fn.newsfeed.defaults, options);
				
		/* private instance functions
		-------------------------------------------------- */
		
		// iterate through each matched element
		return this.each(function(elmIndex) {
			
			// feeds arrays
			var feeds 			= [];
			var feedsLocked 	= [];
			var feedsUnlocked 	= [];
			var feedsCache		= {};

			// tabs object
			var $tabs = {};

			// if Yahoo Pipes is unavailable, fall back to Google Feeds
			var fb = true;
			
			// unique id used by the cookie
			var uniqueId = $(this).attr("id");
			
			// private variables scoped to matched element
			var $original = $(this); // cache the original object
			var $tabnav = {};
				
			// iterate through default feeds in the markup
			$original.find('a').each(function(j) {
				
				// set default settings for the feeds
				var settings = {};
				
				// get metadata from html and make safe so it can't break this script when we eval it
				var metadata = $(this).attr('title').replace(new RegExp(/[^a-zA-Z0-9\,\:\s]+/g), "");	
				if (metadata !== "") {
					eval('settings={'+metadata+'}');					
				}	
				typeof(settings.style)=="undefined" ? settings.style = opts.disp : '';
				typeof(settings.limit)=="undefined" ? settings.limit = opts.lim : '';
				typeof(settings.refresh)=="undefined" ? settings.refresh = opts.ref : '';
				
				feedsLocked[j] = { 
					title			: $(this).html(),
					url				: $(this).attr('href'),
					disp 			: settings.style,
					lim				: settings.limit,
					ref				: settings.refresh,
					fb				: 0,
					lock			: 1
				};
			});
			
			feeds = feedsLocked;
			
			// See if there are any user created feeds stored in the cookie
			if ($.cookie("FEEDDATA")!==null) {
				
				// retreive cookie data, if it exists
				feedsCache = JSON.parse($.cookie("FEEDDATA"));
				if (typeof(feedsCache[uniqueId]) !=="undefined") {
					feedsUnlocked = feedsCache[uniqueId][0];
					
					// merge feeds array into one
					feeds = $.merge(feedsLocked, feedsUnlocked);
					
					// now we need to refresh the cookie, so it doesn't run out
					updateCookie();
				}
			}
				
			function init() {	
				
				// delete original list
				$original.find('ul').remove();
					
				// add an unordered list to contain the tabbed navigation
				$original.append('<ul id="tabNav'+elmIndex+'"></ul>'+"\n");
				
				$tabnav = $('#tabNav'+elmIndex);
				
				for (i=0;i<feeds.length;i++) {
					
					// build markup
					$tabnav.append('<li><a href="#feed'+elmIndex+'-'+i+'"><span>'+feeds[i].title+'</span></a></li>'+"\n");
					addDeleteBtn(i);
					
					// add panels
					$original.append("<div id=\"feed"+elmIndex+"-"+i+"\"></div>\n");
					
					// load feed for this tab
					loadFeed(i);		
				}
				
				// add the '+add' tab
				$tabnav.append('<li class="nf-addfeed"><a href="#feed'+elmIndex+'-add" title="Add a new feed"><span>Add</span></a></li>'+"\n");

				// add the '+add' panel form template
				addForm();
				
				// initialise the tabs
				$tabs = $tabnav.tabs({ fx: { opacity: 'toggle', duration: 'fast' } });
				
				// add reset form behaviour to '+add' tab
				$('[href$=#feed'+elmIndex+'-add]').click(resetForm);
				
				// add refresh feeds timer
				refresh(true);
			}
			
			function refresh(init) {
				var init = init || false; // set default 
				
				if (!init) {
					for (i=0;i<feeds.length;i++) {
						
						// ignore deleted tabs
						if (!feeds[i].deleted) {
							
							// count down a minute
							feeds[i].timeToRefresh -=1;
							
							if (feeds[i].timeToRefresh === 0) {
								//reset to refresh
								feeds[i].timeToRefresh = feeds[i].ref;
								// we need to reload this feed
								loadFeed(i);
							}
						}
					}
				} else {
					for (i=0;i<feeds.length;i++) {
						// set starting values
						feeds[i].timeToRefresh = feeds[i].ref;
					}
				}
				// set refresh feeds timer for 1 minute later (60000 milliseconds)
				// use a closure to retain the local scope
				var refreshTimer=setTimeout(function(){refresh();},60000);
			}
			
			function addForm() {
				$original.append($.fn.newsfeed.formAddTpl);
				
				// assign the enclosing form div an id 
				$original.find('.feed-add').attr("id","feed"+elmIndex+"-add");
				
				// make the options show/hide
				$original.find('.drawer').hide();
				
				$original.find(".drawer-btn > a").click(function() {
				    $('.drawer').toggle(200);
					toggleBtn($(this));
				    return false;
				});	
				
				// add submit event
				$('#feed'+elmIndex+'-add > form').submit(parseForm);
			}
			
			function toggleBtn($btn) {
				if ($btn.attr("class") != "active") {
			   		$btn.attr("class","active");
					$btn.html('Fewer options');
			   	} else {
			   		$btn.attr("class","");
					$btn.html('More options');
				}
			}

			function loadFeed(feedId) {
					
				var $obj = $('#feed'+elmIndex+'-'+feedId);
				var url  = escape(feeds[feedId].url);
				var pipe = '';
				
				// keyword search or website url?
				if (feeds[feedId].url.indexOf(".") != -1) {
					if (!feeds[feedId].fb) {
						pipe = opts.pipe+'&url='+url+'&auto='+url;
					} else if (feeds[feedId].fb == 1) {
						pipe = opts.fb+'&q='+url;
					}	
				} else {
					if (!feeds[feedId].fb) {
						pipe = opts.pipeSearch+'&keywords='+url;
					}
				}
								
				// add a div to hold the stories
				$obj.html('<div class="nf-loading"></div>');
				
				var beforeCall = _jsonpList();
				feeds[feedId].loading = 1;
				
				// run the pipe
				if (pipe !== '') {
					$.getJSON(pipe, function(data){
						
						// clear timeout
						clearTimeout(loadTimeout);
						
						// set flag that this feed is loading
						feeds[feedId].loading = 0;

						var newslist = $("<ul></ul>");
						
						$obj.html(newslist);
						
						//add feed edit/lock button
						var $editBtn='';
						if (!feeds[feedId].lock) {
							$editBtn = $('<a class="nf-editfeed" title="Edit this feed" href="#"></a>');
							$editBtn.click(function(){
								editFeed(feedId);
							});
						} else {
							$editBtn = $('<a class="nf-locked" title="This tab is locked"></a>');
						}	
						$obj.append($editBtn);
						
						var items = [];
						
						if (!feeds[feedId].fb) {
							if (data.value !== null) {
								items = data.value.items;
							}
						} else if (feeds[feedId].fb == 1){
							if (data.responseData !== null) {
								items = data.responseData.feed.entries;
							}	
						}
						
						if (items.length>0) {
							$.each(items, function(i,item){
								
								var link 	= item.link;
								var title 	= item.title.replace(new RegExp(/\\/g),"");
								var img 	= '';
								var pubDate = '';
								var desc	= '';
								
								if (!feeds[feedId].fb) {
									// Yahoo pipe json result format
									pubDate = item.pubDate === null ? "Today" : item.pubDate;
									desc 	= item.description.replace(new RegExp(/\\/g),"");
									
								} else if(feeds[feedId].fb == 1) {
									// Google json result format
									pubDate = item.publishedDate === null ? "Today" : item.publishedDate;
									desc 	= item.content.replace(new RegExp(/\\/g),"");
								}
							
								// first let's try to extract an image from the description, where it's often put
								img = $(desc).find('img').attr('src');
							
								// look in other nodes for a thumbnail image, if they are defined
								if (typeof(item["media:content"]) !== 'undefined') {
									if (typeof(item["media:content"]).url !== 'undefined') {	
										img = item["media:content"].url;
									}
								}
								if (typeof(item["media:thumbnail"]) !== 'undefined') {
									if (typeof(item["media:thumbnail"]).url !== 'undefined') {
										img = item["media:thumbnail"].url;
									}
								} 
								if (typeof(item["media:group"]) !== 'undefined') {
									if (typeof(item["media:group"]["media:thumbnail"]) !== 'undefined') {
										img = item["media:group"]["media:thumbnail"];
									}
								}
                	
								// preprare image if found
								imgTag ='';
								if (typeof(img) !=='undefined' && img !=='' && img.indexOf('.jpg') !=-1) {
									imgTag = '<img width="46" height="38" src="'+img+'" alt="" />';
								}
							
								// strip html tags from description
								desc = desc.replace(/(<([^>]+)>)/ig," ");
							
								// display templates
								var tpl='';
								if (feeds[feedId].disp == 1 && imgTag !=='') {	
									tpl = 	'<li class="display-1">'+
											'	<a class="nf-link" target="_blank" title="View story" href="'+link+'">'+imgTag+
											'		<strong>'+title+'</strong>'+
											'		<span class="desc">'+desc+'</span>'+
											'	</a>'+
											'</li>';							
								} else if (feeds[feedId].disp == 2 || (feeds[feedId].disp == 1 && imgTag ==='') ) {
									tpl = 	'<li class="display-2">'+
											'	<a class="nf-link" target="_blank" title="View story" href="'+link+'">'+
											'		<strong>'+title+'</strong>'+
											'		<span class="desc">'+desc+'</span>'+
											'	</a>'+
											'</li>';
								} else {
									tpl = 	'<li class="display-3">'+
											'	<a class="nf-link" target="_blank" title="View story" href="'+link+'">'+
											'		<span>'+pubDate+'</span>'+
											'		<strong>'+title+'</strong>'+
											'	</a>'+
											'</li>';		
								}
							
								// add to the list
								$obj.find('ul').append(tpl);
							
								 //limit
								if (i==feeds[feedId].lim-1) {
									return false;
								}
					
							}); // <-end each()
						
							// truncate description strings
							$obj.find('.desc').truncate( 90,{
						        chars: /\s/,
						        trail: [ " (<a href='#' class='truncate_show'>more</a>...)", "(...<a href='#' class='truncate_hide'>less</a>)" ]
						    });
					
							// add feed li hovers
							$.fn.newsfeed.feedHover("#feed"+elmIndex+"-"+feedId);
							
						} else {
							if (!feeds[feedId].fb) {
								$obj.html('<p class="nf-error">Sorry, no feeds were found. Please try again.</p>');
							} else {
								$obj.html('<p class="nf-error">Sorry, either no feeds were found at the address or the service is temporarily unavailable. Please try again later.</p>');
							}
						}
					}); // <!-end jsonp call
				} else { // no pipe available
					$obj.html('<p class="nf-error">Sorry, keyword search is temporarily unavailable. Please try again later.</p>');
				}
				
				var afterCall = _jsonpList();
				var lastJSONPCallKey = _jsonpDiff(beforeCall, afterCall)[0];
				
				// only set the fb timer if we haven't already tried to load this feed
				if (!feeds[feedId].fb) {
					loadTimeout = setTimeout(function(){setFallback(feedId,lastJSONPCallKey);},opts.feedTimeout);
				}
			}
			
			function setFallback(feedId, jsonp) {	
				if (feeds[feedId].loading) { // if the feed is still loading
					// abort current jsonp call for this feed
					window[jsonp] = function(){};
					// increment fb flag and reload this feed
					feeds[feedId].fb++;
					loadFeed(feedId);
				}
			}
			
			function addDeleteBtn(feedId) {
				if (!feeds[feedId].lock) {
					var $deleteBtn = $('<a href="#" class="nf-deletefeed"></a>');
					$deleteBtn.click(function(){
						deleteTab(feedId);
					});
					$('[href$=#feed'+elmIndex+'-'+feedId+']').after($deleteBtn);
				}
			}	
			
			function addTab(title,url,disp,lim,refresh) {
				
				j=0;
				for (i=0;i<feeds.length;i++) {
					if (!feeds[i].deleted) j++;
				}
				
				// limit number of tabs to tabsMax
				if (j<opts.tabsMax && opts.tabsMax>0 ) {
					// get the last element on the array
					feedId = feeds.length;
				
					// add to the end of our feeds array
					updateFeed(feedId,title,url,disp,lim,refresh);	
				
					// add the tab and select - this creates the panel <div> as well	
					$tabs.tabs("add", '#feed'+elmIndex+'-'+feedId, title);
					$tabs.tabs('select', '#feed'+elmIndex+'-'+feedId);
				
					// add delete
					addDeleteBtn(feedId);
				
					// add the feed panel
					loadFeed(feedId);
				} else {
					alert('Sorry, no more than '+opts.tabsMax+' tabs are allowed');
				}
			}
			
			function editTab(feedId,title,url,disp,lim,refresh) {
				
				// update feeds array
				updateFeed(feedId,title,url,disp,lim,refresh);
				
				// remame the tab
				$('[href$=#feed'+elmIndex+'-'+feedId+']').find('span').html(title);
				
				// reload the feed panel
				loadFeed(feedId);
				
				// fade out the form and fade in the feed
				$('#feed'+elmIndex+'-add').fadeTo("fast",0,function() {	
					// remove it from page flow
					$('#feed'+elmIndex+'-add').css({display: 'none'});
					
					// now fade in the feed
					$('#feed'+elmIndex+'-'+feedId).fadeTo(1,0,'');	
					$('#feed'+elmIndex+'-'+feedId).css({display: 'block'});
					$('#feed'+elmIndex+'-'+feedId).fadeTo("normal",1,'');
				});
			}
			
			// new/edited feeds: update feeds array
			function updateFeed(feedId,title,url,disp,lim,refresh) {
				feeds[feedId] = {
					title			: title,
					url				: url,
					disp 			: disp,
					lim				: lim,
					ref				: refresh,
					timeToRefresh	: refresh, // reset to start
					fb				: 0,
					lock			: 0 // new/editable feeds are always unlocked
				};
				updateCookie();
			}
			
			function updateCookie() {

				var feedData = {};
				var now = new Date();
				var timestamp = now.getTime();
				var expire	  = 30*24*60*60*1000; // 30 days in milliseconds

				//get all existing cookie data
				if ($.cookie("FEEDDATA")!==null) {
					feedData = JSON.parse($.cookie("FEEDDATA"));
					
				}
				// garbage collection
				for(var property in feedData) {
					if ((timestamp-feedData[property][1]) > expire) {
						delete(feedData[property]);
					}
				}
				
				//create a reference point for this feed
				feedData[uniqueId]=[];
				feedData[uniqueId][0] = []; // array where we'll store the feeds for this id
				feedData[uniqueId][1] = timestamp; // timestamp
				
				j=0;
				for (i=0;i<feeds.length;i++) {
					// ignore deleted & locked tabs
					if (!feeds[i].deleted && !feeds[i].lock) {
						feedData[uniqueId][0][j] = {
							title			: feeds[i].title,
							url				: feeds[i].url,
							disp 			: feeds[i].disp,
							lim				: feeds[i].lim,
							ref				: feeds[i].ref,
							fb				: 0,
							lock			: 0
						};
						j++;	
					}
				}
				// update/create cookie
				$.cookie('FEEDDATA', JSON.stringify(feedData), { expires: 30 });
			}
			
			function parseForm(e) {
				
				// grab values from the form
				frm = getFormFields();
				
				if (frm.feedId == '-1') {
					// add a new tab and show it
					if (frm.feedTitle !=='') {
						if (frm.feedUrl!=='') {
							addTab(frm.feedTitle,frm.feedUrl,frm.feedDisplay,frm.feedCount,frm.feedRefresh);
						} else {
							alert('Please enter a feed url, website address or keyword(s).');
						}
					} else {
						alert('Please enter a feed title.');
					}	
				} else {
					//edit existing tab and show it
					editTab(frm.feedId,frm.feedTitle,frm.feedUrl,frm.feedDisplay,frm.feedCount,frm.feedRefresh);
				}
				return false;
			}
				
			function getFormFields() {
				var $frmAdd = $('#feed'+elmIndex+'-add > form');
				var frm = {
					feedTitle 	  : $frmAdd.find("input:text[name='feedtitle']").attr('value'),
					feedUrl   	  : $frmAdd.find("input:text[name='feedurl']").attr('value'),
					feedDisplay   : $frmAdd.find("select[name='feeddisplay']").attr('value'),
					feedCount	  : $frmAdd.find("select[name='feedcount']").attr('value'),
					feedRefresh   : $frmAdd.find("select[name='feedrefresh']").attr('value'),
					feedId 	 	  : $frmAdd.find("input:hidden[name='feedid']").attr('value')
				};
				return frm;
			}
			
			function resetForm() {
				// clear text inputs and reset selects to defaults
				var $frmAdd = $('#feed'+elmIndex+'-add > form');
				$frmAdd.find("input:text[name='feedtitle']").attr({value:''});
				$frmAdd.find("input:text[name='feedurl']").attr({value:''});
				$frmAdd.find("select[name='feeddisplay']").attr({value:opts.disp});
				$frmAdd.find("select[name='feedcount']").attr({value:opts.lim});
				$frmAdd.find("select[name='feedrefresh']").attr({value:opts.ref});
				$frmAdd.find("input:hidden[name='feedid']").attr({value:'-1'});	
			}
			
			function deleteTab(feedId) {	
				// work out the current tab index. All tab hrefs contain '#feed-'. 
				// Be careful of IE - it adds the page url in front of the #namedanchor
				tabindex = $tabnav.find("a[href*='#feed"+elmIndex+"-']")
					.index($tabnav.find("a[href*='#feed"+elmIndex+"-']")
					.filter("a[href$=#feed"+elmIndex+"-"+feedId+"]"));
				
				if ($tabs.tabs("length") <= 2) {
					alert("Sorry, you need to have at least one tab open.");
				} else {	
					var confirmed = confirm('Do you really want to delete \''+feeds[feedId].title+'\'?');
				
					if (confirmed) {
						$tabnav.tabs("remove", tabindex);
					
						// update our feeds array
						// don't delete the index, just delete the data
						feeds[feedId].deleted = 1;
						
						//update cookie
						updateCookie();
					}
				}
			}
			
			function editFeed(feedId) {	
				//fade out the feed
				$('#feed'+elmIndex+'-'+feedId).fadeTo("fast",0,function() {	
					// remove it from page flow
					$('#feed'+elmIndex+'-'+feedId).css({display: 'none'});
					
					// set form values based on feed we're editing
					var $frmAdd = $('#feed'+elmIndex+'-add > form');
					$frmAdd.find("input:text[name='feedtitle']").attr({value:feeds[feedId].title});
					$frmAdd.find("input:text[name='feedurl']").attr({value:feeds[feedId].url});
					$frmAdd.find("select[name='feeddisplay']").attr({value:feeds[feedId].disp});
					$frmAdd.find("select[name='feedcount']").attr({value:feeds[feedId].lim});
					$frmAdd.find("select[name='feedrefresh']").attr({value:feeds[feedId].ref});
					$frmAdd.find("input:hidden[name='feedid']").attr({value:feedId});
					
					// now fade in the form
					var $feedAdd = $('#feed'+elmIndex+'-add');
					$feedAdd.fadeTo(1,0,'');	
					$feedAdd.css({display: 'block'});
					$feedAdd.fadeTo("normal",1,'');
				});
			}		
			
			// initialise
			init();
			
		}); // <-end each()
	};  // <-end constructor
 	
	/* public static variables
	-------------------------------------------------- */
	$.fn.newsfeed.defaults = {
		pipe		 : 'http://pipes.yahoo.com/pipes/pipe.run?_id=cb81087bd9cdb12cd59f40a1db10ec15&_render=json&_callback=?',
		pipeSearch   : 'http://pipes.yahoo.com/pipes/pipe.run?_id=81796b3a5cfc05b1faac3513b099ab48&_render=json&_callback=?',
		fb	 		 : 'http://ajax.googleapis.com/ajax/services/feed/load?v=1.0&output=json&num=10&callback=?',
		disp 		 : 1, 		// display style: must be one of 1, 2 or 3
		lim		 	 : 6, 		// feed limit: must be a number between 1 and 10
		ref		 	 : 10, 		// refresh frequency: must be one of 10, 30, 60, 120, 240
		feedTimeout  : 15000, 	// time allowed for the initial JSONP feed load, in milliseconds
		tabsMax		 : 5		// max number of tabs
	};
	
	$.fn.newsfeed.formAddTpl =
	'<div class="feed-add">'+
	'<form class="nf-frm-add" action ="#" method="post">'+
	'	<fieldset>'+
	'		<div class="col-a">'+
	'			<label>Feed title'+
	'				<input type="text" class="txt" id="feedtitle" name="feedtitle" value="" />'+
	'			</label>'+
	'		</div>'+
	'		<div class="col-b">'+
	'			<label>Feed url, website or keywords'+
	'				<input type="text" class="txt" id="feedurl" name="feedurl" value="" />'+
	'			</label>'+
	'			<input class="img" src="assets/img/newsfeed/go.png" type="image" value="1" name="submit" alt="go" />'+
	'		</div>'+
	'	</fieldset>'+
	'	<fieldset class="drawer">'+
	'		<div class="col-a">'+
	'			<label>Display style'+
	'				<select id="feeddisplay" name="feeddisplay">'+
	'					<option value="1">Headline, summary &amp; picture</option>'+
	'					<option value="2">Headline &amp; summary</option>'+
	'					<option value="3">Headline &amp; date</option>'+
	'				</select>'+
	'			</label>'+
	'		</div>'+
	'		<div class="col-b">'+
	'			<label>No. of stories'+
	'				<select id="feedcount" name="feedcount">'+
	'					<option value="1">1</option>'+
	'					<option value="2">2</option>'+
	'					<option value="3">3</option>'+
	'					<option value="4">4</option>'+
	'					<option value="5">5</option>'+
	'					<option value="6">6</option>'+
	'					<option value="7">7</option>'+
	'					<option value="8">8</option>'+
	'					<option value="9">9</option>'+
	'					<option value="10">10</option>'+	
	'				</select>'+
	'			</label>'+		
	'			<label>Refresh time'+
	'				<select id="feedrefresh" name="feedrefresh">'+
	'					<option value="10">10 mins</option>'+
	'					<option value="30">30 mins</option>'+
	'					<option value="60">1 hour</option>'+
	'					<option value="120">2 hours</option>'+
	'					<option value="240">4 hours</option>'+
	'				</select>'+
	'			</label>'+
	'		</div>'+
	'	</fieldset>'+
	'	<div class="drawer-btn"><a href="#">More options</a></div>'+	
	'	<input type="hidden" id="feedid" name="feedid" value="-1" />'+	
	'</form>'+
	'</div>';
	
	/* public static functions
	-------------------------------------------------- */
	
	$.fn.newsfeed.feedHover = function(panel) {
			
		var colours = [];
		
		$(panel+' li').each(function (i) {

			// record color 
			colours[i] = $(this).css('backgroundColor');
			
			// set image opacity to 70%
			$(this).find('a img').fadeTo(1,0.7,'');				
			
			$(this).hover(function() { //mouseover
				$(this).animate( { backgroundColor: '#FFFFFF' }, 200);
				$(this).css( { 
					"border-top-color": "#CFD5DA", 
					"border-bottom-color": "#CFD5DA"
				});
				$(this).find('a img').fadeTo("normal",1,'');
			},
			function() { //mouseout
				$(this).animate( { backgroundColor: colours[i] }, 1);
				$(this).css( { 
					"border-top-color": colours[i], 
					"border-bottom-color": colours[i]
				});
				$(this).find('a img').fadeTo("normal",0.7,'');
			});
		});	
  	};
	
	/* private static functions
	-------------------------------------------------- */
	
	// utility functions to enable cancelling of an active JSON request after a set timeout
	// see http://www.nabble.com/Canceling-a-JSONP-callback--td19772395s27240.html	
	function _jsonpList(){
	    var found =[], key;
	    for(key in window) {
	        if(/^jsonp[0-9]+$/.test(key)) {
				found.push(key);
			}
		}
	    return  found;
	}

	function _jsonpDiff(listBefore, listAfter){
	    if (2 < arguments.length) {
			listAfter = arguments[2];
		}
	    return listAfter.join("|").replace(new RegExp(listBefore.join("|"), "g"), "").replace(/\|+/g, "|").replace(/^\|+|\|+$/g, "").split("|");
	}
	
})(jQuery); // enclosure