/**
 * @fileoverview
 * Provides the JavaScript interactions for all pages.
 *
 * @author 
 * Andrew Orians
 */

/** namespace. */
var rhit = rhit || {};

rhit.FB_COLLECTION_USERS = "Users";
rhit.FB_COLLECTION_ROUTES = "Routes";
rhit.FB_KEY_ROUTES = "routes";
rhit.FB_KEY_NOTES = "notes";
rhit.FB_KEY_START_DATES = "startDates";
rhit.FB_KEY_IN_PROGRESS = "inProgress";
rhit.FB_KEY_JOIN_DATE = "joinDate";
rhit.FB_KEY_NAME = "name";
rhit.FB_KEY_DIFFICULTY = "difficulty";
rhit.FB_KEY_LAT = "lat";
rhit.FB_KEY_LONG = "long";
rhit.FB_KEY_LAST_TOUCHED = "lastTouched";
rhit.FB_KEY_USERS = "users";
rhit.fbAuthManager = null;
rhit.fbRoutesManager = null;
rhit.fbSingleRouteManager = null;
rhit.fbStatsManager = null;

function htmlToElement(html) {
	var template = document.createElement("template");
	html = html.trim();
	template.innerHTML = html;
	return template.content.firstChild;
}

rhit.FbAuthManager = class {
	constructor() {
		this._user = null;
		this._userDoc = null;
		this._realUserDoc = null;
		this._unsubscribe = null;
		this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_USERS);
	}
	beginListening(changeListener) {
		firebase.auth().onAuthStateChanged((user) => {
			this._user = user;
			if (this._user) {
				this._unsubscribe = this._ref.doc(this._user.uid).onSnapshot((doc) => {
					if (!doc.exists) {
						this._ref.doc(this._user.uid).set({
								[rhit.FB_KEY_ROUTES]: [],
								[rhit.FB_KEY_NOTES]: [],
								[rhit.FB_KEY_START_DATES]: [],
								[rhit.FB_KEY_IN_PROGRESS]: [],
								[rhit.FB_KEY_JOIN_DATE]: firebase.firestore.Timestamp.now()
							})
							.then(() => {
								console.log("User successfully added!");
							})
							.catch((error) => {
								console.log("Error creating user: ", error);
							});
					}
					this._userRef = this._ref.doc(this._user.uid);
					this._userRef.onSnapshot((doc) => {
						if (doc.exists) {
							rhit.fbAuthManager._userDoc = doc;
							changeListener();
						}
					});
				});
			}
			if (!document.querySelector("#listPage")) {
				changeListener(); // Creates difficulties with add there
			}
		});
	}
	signOut() {
		firebase.auth().signOut().then(() => {
			console.log("You are now signed out");
			window.location.href = "/";
		}).catch((error) => {
			// An error happened.
			console.log("Sign out error");
		});
	}
	get isSignedIn() {
		return !!this._user;
	}
	get uid() {
		return this._user.uid;
	}
	get user() {
		return this._userDoc;
	}
	get userRef() {
		return this._userRef;
	}

	get routes() {
		return this._userDoc.get(rhit.FB_KEY_ROUTES);
	}

	get startDates() {
		return this._userDoc.get(rhit.FB_KEY_START_DATES);
	}

	get notes() {
		return this._userDoc.get(rhit.FB_KEY_NOTES);
	}

	get inProgresses() {
		return this._userDoc.get(rhit.FB_KEY_IN_PROGRESS);
	}

	get joinDate() {
		return this._userDoc.get(rhit.FB_KEY_JOIN_DATE).toDate();
	}
}

rhit.ListPageController = class {
	constructor() {
		document.querySelector("#toAllRoutes").addEventListener("click", (event) => {
			window.location.href = "/list.html";
		});
		document.querySelector("#toMyRoutes").addEventListener("click", (event) => {
			window.location.href = `/list.html?uid=${rhit.fbAuthManager.uid}`;
		});
		document.querySelector("#toMyStats").addEventListener("click", (event) => {
			window.location.href = `/stats.html`;
		});
		document.querySelector("#menuSignOut").addEventListener("click", (event) => {
			rhit.fbAuthManager.signOut();
		});

		document.querySelector("#submitAddRoute").addEventListener("click", (event) => {
			const name = document.querySelector("#inputName").value;
			const difficulty = document.querySelector("#inputDifficulty").value;
			const lat = parseFloat(document.querySelector("#inputLat").value);
			const long = parseFloat(document.querySelector("#inputLong").value);
			rhit.fbRoutesManager.add(name, difficulty, lat, long);
		});

		$("#addRouteDialog").on("show.bs.modal", (event) => {
			document.querySelector("#inputName").value = "";
			document.querySelector("#inputDifficulty").value = "";
			document.querySelector("#inputLat").value = "";
			document.querySelector("#inputLong").value = "";
		});
		$("#addRouteDialog").on("shown.bs.modal", (event) => {
			document.querySelector("#inputName").focus();
		});

		rhit.fbRoutesManager.beginListening(this.updateList.bind(this));
	}

	_createCard(route) {
		return htmlToElement(`<div class="card">
        <div class="card-body">
          <h5 class="card-title">${route.name}</h5>
        </div>
      </div>`);
	}

	updateList() {
		const newList = htmlToElement('<div id="routeListContainer"></div>');

		for (let i = 0; i < rhit.fbRoutesManager.length; i++) {
			const route = rhit.fbRoutesManager.getRouteAtIndex(i);
			const newCard = this._createCard(route);
			newCard.onclick = (event) => {
				window.location.href = `/routeview.html?id=${route.id}`;
			};
			newList.appendChild(newCard);
		}

		const oldList = document.querySelector("#routeListContainer");
		oldList.removeAttribute("id");
		oldList.hidden = true;

		oldList.parentElement.appendChild(newList);
	}
}

rhit.Route = class {
	constructor(id, name) {
		this.id = id;
		this.name = name;
	}
}

rhit.FbRoutesManager = class {
	constructor(uid) {
		this._uid = uid;
		this._documentSnapshots = [];
		this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_ROUTES);
		this._unsubscribe = null;
	}
	add(name, difficulty, lat, long) {
		this._ref.add({
				[rhit.FB_KEY_NAME]: name,
				[rhit.FB_KEY_DIFFICULTY]: difficulty,
				[rhit.FB_KEY_LAT]: lat,
				[rhit.FB_KEY_LONG]: long,
				[rhit.FB_KEY_LAST_TOUCHED]: firebase.firestore.Timestamp.now(),
				[rhit.FB_KEY_USERS]: []
			})
			.then(function (docRef) {
				console.log("Document written with ID: ", docRef.id);
			})
			.catch(function (error) {
				console.error("Error adding document: ", error);
			});
	}
	beginListening(changeListener) {
		let query = this._ref.orderBy(rhit.FB_KEY_LAST_TOUCHED, "desc").limit(50);
		if (this._uid) {
			query = query.where(rhit.FB_KEY_USERS, "array-contains", this._uid);
		}
		query.onSnapshot((querySnapshot) => {
			this._documentSnapshots = querySnapshot.docs;
			changeListener();
		});
	}
	stopListening() {
		this._unsubscribe();
	}
	get length() {
		return this._documentSnapshots.length;
	}
	getRouteAtIndex(index) {
		const docSnapshot = this._documentSnapshots[index];
		const route = new rhit.Route(docSnapshot.id, docSnapshot.get(rhit.FB_KEY_NAME));
		return route;
	}
}

rhit.DetailPageController = class {
	constructor() {
		document.querySelector("#submitEditRoute").addEventListener("click", (event) => {
			const name = document.querySelector("#inputName").value;
			const difficulty = document.querySelector("#inputDifficulty").value;
			const lat = parseFloat(document.querySelector("#inputLat").value);
			const long = parseFloat(document.querySelector("#inputLong").value);
			let inProgress = null;
			let notes = null;
			let startDate = null;
			if (rhit.fbSingleRouteManager.users.includes(rhit.fbAuthManager.uid)) {
				inProgress = document.querySelector("#editInProgress").checked;
				notes = document.querySelector("#editNotes").value;
				startDate = document.querySelector("#editStartDate").value;
			}
			rhit.fbSingleRouteManager.update(name, difficulty, lat, long, inProgress, notes, startDate);
		});

		document.querySelector("#submitAddRoute").addEventListener("click", (event) => {
			const inProgress = document.querySelector("#inProgress").checked;
			const startDate = document.querySelector("#inputStartDate").value;
			const notes = document.querySelector("#inputNotes").value;
			rhit.fbSingleRouteManager.addToMyRoutes(inProgress, startDate, notes);
		});

		$("#editRouteDialog").on("show.bs.modal", (event) => {
			document.querySelector("#inputName").value = rhit.fbSingleRouteManager.name;
			document.querySelector("#inputName").parentElement.classList.add("is-filled");
			document.querySelector("#inputDifficulty").value = rhit.fbSingleRouteManager.difficulty;
			document.querySelector("#inputDifficulty").parentElement.classList.add("is-filled");
			document.querySelector("#inputLat").value = rhit.fbSingleRouteManager.lat;
			document.querySelector("#inputLat").parentElement.classList.add("is-filled");
			document.querySelector("#inputLong").value = rhit.fbSingleRouteManager.long;
			document.querySelector("#inputLong").parentElement.classList.add("is-filled");
			if (rhit.fbSingleRouteManager.users.includes(rhit.fbAuthManager.uid)) {
				let index = rhit.fbAuthManager.routes.indexOf(rhit.fbSingleRouteManager.name);
				document.querySelector("#editStartDate").value = rhit.fbAuthManager.startDates[index];
				document.querySelector("#editStartDate").parentElement.classList.add("is-filled");
				document.querySelector("#editInProgress").checked = rhit.fbAuthManager.inProgresses[index];
				document.querySelector("#editInProgress").parentElement.classList.add("is-filled");
				document.querySelector("#editNotes").value = rhit.fbAuthManager.notes[index];
				document.querySelector("#editNotes").parentElement.classList.add("is-filled");
			}
		});
		$("#editRouteDialog").on("shown.bs.modal", (event) => {
			document.querySelector("#inputName").focus();
		});

		$("#addRouteDialog").on("show.bs.modal", (event) => {
			document.querySelector("#inProgress").checked = true;
			let now = new Date();
			document.querySelector("#inputStartDate").value = (now.getMonth() + 1) + "/" + now.getDate() + "/" + now.getFullYear();
			document.querySelector("#inputStartDate").parentElement.classList.add("is-filled");
			document.querySelector("#inputNotes").value = "";
		});
		$("#addRouteDialog").on("shown.bs.modal", (event) => {
			document.querySelector("#inputStartDate").focus();
		});

		document.querySelector("#toAllRoutes").addEventListener("click", (event) => {
			window.location.href = "/list.html";
		});
		document.querySelector("#toMyRoutes").addEventListener("click", (event) => {
			window.location.href = `/list.html?uid=${rhit.fbAuthManager.uid}`;
		});
		document.querySelector("#toMyStats").addEventListener("click", (event) => {
			window.location.href = `/stats.html`;
		});
		document.querySelector("#menuSignOut").addEventListener("click", (event) => {
			rhit.fbAuthManager.signOut();
		});

		document.querySelector("#menuDelete").addEventListener("click", (event) => {
			rhit.fbSingleRouteManager.delete();
		});

		initMap();

		rhit.fbSingleRouteManager.beginListening(this.updateView.bind(this));
	}

	updateView() {
		if (rhit.fbSingleRouteManager.name) {
			document.querySelector("#name").innerHTML = rhit.fbSingleRouteManager.name;
			document.querySelector("#difficulty").innerHTML = rhit.fbSingleRouteManager.difficulty;
			//document.querySelector("#location").innerHTML = rhit.fbSingleRouteManager.location;
		}

		if (rhit.fbSingleRouteManager.users.includes(rhit.fbAuthManager.uid)) {
			let index = rhit.fbAuthManager.routes.indexOf(rhit.fbSingleRouteManager.name);
			document.querySelector("#startDate").innerHTML = rhit.fbAuthManager.startDates[index];
			if (rhit.fbAuthManager.inProgresses[index]) {
				document.querySelector("#status").innerHTML = "In Progress";
			} else {
				document.querySelector("#status").innerHTML = "Completed";
			}
			document.querySelector("#notes").innerHTML = rhit.fbAuthManager.notes[index];

			document.querySelector("#menuAdd").style.display = "none";
			document.querySelector("#menuDelete").style.display = "flex";
		} else {
			document.querySelector("#privateDetails").hidden = true;
			document.querySelector("#modalPrivateDetails").hidden = true;
		}
	}
}

// The maps api uses this as a callback, so it has to be global
function initMap() {
	// Wait unil the fbSingleRouteManager has been initialized
	setTimeout(() => {
		const routeLocation = {
			lat: rhit.fbSingleRouteManager.lat,
			lng: rhit.fbSingleRouteManager.long
		};
		const map = new google.maps.Map(document.getElementById("map"), {
			zoom: 15,
			center: routeLocation,
		});
		const marker = new google.maps.Marker({
			position: routeLocation,
			map: map,
			title: rhit.fbSingleRouteManager.name
		});
		marker.setAnimation(google.maps.Animation.DROP);
	}, 5);
}

rhit.FbSingleRouteManager = class {
	constructor(routeId) {
		this._documentSnapshot = {};
		this._unsubscribe = null;
		this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_ROUTES).doc(routeId);
	}
	beginListening(changeListener) {
		this._unsubscribe = this._ref.onSnapshot((doc) => {
			if (doc.exists) {
				this._documentSnapshot = doc;
				changeListener();
			} else {

			}
		});
	}
	stopListening() {
		this._unsubscribe();
	}

	update(name, difficulty, lat, long, inProgress, notes, startDate) {
		this._ref.update({
				[rhit.FB_KEY_NAME]: name,
				[rhit.FB_KEY_DIFFICULTY]: difficulty,
				[rhit.FB_KEY_LAT]: lat,
				[rhit.FB_KEY_LONG]: long,
				[rhit.FB_KEY_LAST_TOUCHED]: firebase.firestore.Timestamp.now()
			})
			.then(() => {
				console.log("Document successfully updated!");
			})
			.catch((error) => {
				console.error("Error updating document: ", error);
			});
		if (notes != null) {
			let index = rhit.fbAuthManager.routes.indexOf(rhit.fbSingleRouteManager.name);
			let newProgress = rhit.fbAuthManager.user.get(rhit.FB_KEY_IN_PROGRESS);
			let newNotes = rhit.fbAuthManager.user.get(rhit.FB_KEY_NOTES);
			let newStarts = rhit.fbAuthManager.user.get(rhit.FB_KEY_START_DATES);
			newProgress[index] = inProgress;
			newNotes[index] = notes;
			newStarts[index] = startDate;
			rhit.fbAuthManager.userRef.update({
				[rhit.FB_KEY_IN_PROGRESS]: newProgress,
				[rhit.FB_KEY_NOTES]: newNotes,
				[rhit.FB_KEY_START_DATES]: newStarts
			});
		}
	}

	addToMyRoutes(inProgress, startDate, notes) {
		let newRoutes = rhit.fbAuthManager.user.get(rhit.FB_KEY_ROUTES);
		let newProgress = rhit.fbAuthManager.user.get(rhit.FB_KEY_IN_PROGRESS);
		let newNotes = rhit.fbAuthManager.user.get(rhit.FB_KEY_NOTES);
		let newStarts = rhit.fbAuthManager.user.get(rhit.FB_KEY_START_DATES);
		newRoutes.push(this._documentSnapshot.get(rhit.FB_KEY_NAME));
		newProgress.push(inProgress);
		newNotes.push(notes);
		newStarts.push(startDate);
		rhit.fbAuthManager.userRef.update({
			[rhit.FB_KEY_ROUTES]: newRoutes,
			[rhit.FB_KEY_IN_PROGRESS]: newProgress,
			[rhit.FB_KEY_NOTES]: newNotes,
			[rhit.FB_KEY_START_DATES]: newStarts
		});
		this._ref.update({
			[rhit.FB_KEY_USERS]: firebase.firestore.FieldValue.arrayUnion(rhit.fbAuthManager.uid)
		});
	}

	delete() {
		let index = rhit.fbAuthManager.routes.indexOf(rhit.fbSingleRouteManager.name);
		let newRoutes = rhit.fbAuthManager.user.get(rhit.FB_KEY_ROUTES);
		let newProgress = rhit.fbAuthManager.user.get(rhit.FB_KEY_IN_PROGRESS);
		let newNotes = rhit.fbAuthManager.user.get(rhit.FB_KEY_NOTES);
		let newStarts = rhit.fbAuthManager.user.get(rhit.FB_KEY_START_DATES);
		newRoutes.splice(index, 1);
		newProgress.splice(index, 1);
		newNotes.splice(index, 1);
		newStarts.splice(index, 1);
		rhit.fbAuthManager.userRef.update({
			[rhit.FB_KEY_ROUTES]: newRoutes,
			[rhit.FB_KEY_IN_PROGRESS]: newProgress,
			[rhit.FB_KEY_NOTES]: newNotes,
			[rhit.FB_KEY_START_DATES]: newStarts
		});
		this._ref.update({
			[rhit.FB_KEY_USERS]: firebase.firestore.FieldValue.arrayRemove(rhit.fbAuthManager.uid)
		});
	}

	get name() {
		if (this._documentSnapshot) {
			return this._documentSnapshot.get(rhit.FB_KEY_NAME);
		} else {
			return null;
		}
	}

	get lat() {
		if (this._documentSnapshot) {
			return this._documentSnapshot.get(rhit.FB_KEY_LAT);
		} else {
			return null;
		}
	}

	get long() {
		if (this._documentSnapshot) {
			return this._documentSnapshot.get(rhit.FB_KEY_LONG);
		} else {
			return null;
		}
	}

	get difficulty() {
		if (this._documentSnapshot) {
			return this._documentSnapshot.get(rhit.FB_KEY_DIFFICULTY);
		} else {
			return null;
		}
	}

	get users() {
		if (this._documentSnapshot) {
			return this._documentSnapshot.get(rhit.FB_KEY_USERS);
		} else {
			return null;
		}
	}

	get route() {
		return this._documentSnapshot;
	}
}

rhit.StatsPageController = class {
	constructor() {
		document.querySelector("#toAllRoutes").addEventListener("click", (event) => {
			window.location.href = "/list.html";
		});
		document.querySelector("#toMyRoutes").addEventListener("click", (event) => {
			window.location.href = `/list.html?uid=${rhit.fbAuthManager.uid}`;
		});
		document.querySelector("#toMyStats").addEventListener("click", (event) => {
			window.location.href = `/stats.html`;
		});
		document.querySelector("#menuSignOut").addEventListener("click", (event) => {
			rhit.fbAuthManager.signOut();
		});

		const routesProgress = rhit.fbAuthManager.inProgresses;
		let numInProgress = 0;
		for (const bool of routesProgress) {
			if (bool) {
				numInProgress++;
			}
		}
		document.querySelector("#total").innerHTML = routesProgress.length;
		document.querySelector("#inProgress").innerHTML = numInProgress;
		document.querySelector("#completed").innerHTML = routesProgress.length - numInProgress;

		document.querySelector("#dateJoined").innerHTML = rhit.fbAuthManager.joinDate.toLocaleDateString();
	}
}

rhit.checkForRedirects = function () {
	if (document.querySelector("#loginPage") && rhit.fbAuthManager.isSignedIn) {
		window.location.href = `/list.html?uid=${rhit.fbAuthManager.uid}`;
	}

	if (!document.querySelector("#loginPage") && !rhit.fbAuthManager.isSignedIn) {
		window.location.href = "/";
	}
}

rhit.initializePage = function () {
	if (document.querySelector("#loginPage")) {
		rhit.startFirebaseUI();
	}

	if (document.querySelector("#listPage")) {
		const urlParams = new URLSearchParams(window.location.search);
		const userId = urlParams.get("uid");

		rhit.fbRoutesManager = new rhit.FbRoutesManager(userId);
		new rhit.ListPageController();
	}

	if (document.querySelector("#detailPage")) {
		const urlParams = new URLSearchParams(window.location.search);
		const routeId = urlParams.get("id");
		if (!routeId) {
			window.location.href = "/";
		}
		rhit.fbSingleRouteManager = new rhit.FbSingleRouteManager(routeId);
		new rhit.DetailPageController();
	}

	if (document.querySelector("#statsPage")) {
		new rhit.StatsPageController();
	}
}

/* Main */
/** function and class syntax examples */
rhit.main = function () {
	console.log("Ready");

	rhit.fbAuthManager = new rhit.FbAuthManager();
	rhit.fbAuthManager.beginListening(() => {
		rhit.checkForRedirects();
		rhit.initializePage();
	});
};

rhit.startFirebaseUI = function () {
	// FirebaseUI config.
	var uiConfig = {
		signInSuccessUrl: '/',
		signInOptions: [
			firebase.auth.GoogleAuthProvider.PROVIDER_ID,
			firebase.auth.EmailAuthProvider.PROVIDER_ID
		],
	};

	// Initialize the FirebaseUI Widget using Firebase.
	const ui = new firebaseui.auth.AuthUI(firebase.auth());
	// The start method will wait until the DOM is loaded.
	ui.start('#firebaseui-auth-container', uiConfig);
};

rhit.main();