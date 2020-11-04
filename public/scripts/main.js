/**
 * @fileoverview
 * Provides the JavaScript interactions for all pages.
 *
 * @author 
 * Andrew Orians, Sam Dunaway
 */

/** namespace. */
var rhit = rhit || {};

rhit.FB_COLLECTION_USERS = "Users";
rhit.FB_COLLECTION_ROUTES = "Routes";
rhit.FB_KEY_ROUTES = "routes";
rhit.FB_KEY_NOTES = "notes";
rhit.FB_KEY_START_DATES = "startDates";
rhit.FB_KEY_IN_PROGRESS = "inProgress";
rhit.FB_KEY_NAME = "name";
rhit.FB_KEY_DIFFICULTY = "difficulty";
rhit.FB_KEY_LOCATION = "location";
rhit.FB_KEY_LAST_TOUCHED = "lastTouched";
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
								[rhit.FB_KEY_IN_PROGRESS]: []
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
							this._userDoc = doc;
						}
					});
				});
			}
			changeListener();
		});
	}
	signOut() {
		firebase.auth().signOut().then(() => {
			console.log("You are now signed out");
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
			window.location.href = `/stats.html?uid=${rhit.fbAuthManager.uid}`;
		});
		document.querySelector("#menuSignOut").addEventListener("click", (event) => {
			rhit.fbAuthManager.signOut();
		});

		document.querySelector("#submitAddRoute").addEventListener("click", (event) => {
			const name = document.querySelector("#inputName").value;
			const difficulty = document.querySelector("#inputDifficulty").value;
			const location = document.querySelector("#inputLocation").value;
			rhit.fbRoutesManager.add(name, difficulty, location);
		});

		$("#addRouteDialog").on("show.bs.modal", (event) => {
			document.querySelector("#inputName").value = "";
			document.querySelector("#inputDifficulty").value = "";
			document.querySelector("#inputLocation").value = "";
		});
		$("#addPhotoDialog").on("shown.bs.modal", (event) => {
			document.querySelector("#inputName").focus();
		});

		rhit.fbRoutesManager.beginListening(this.updateList.bind(this));
	}

	_createCard(route) {
		return htmlToElement(`<div class="card">
        <div class="card-body">
          <h5 class="card-title">${route.name}</h5>
          <img src="${route.img}" alt="" class="inProgressDot">
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
	constructor(id, name, img) {
		this.id = id;
		this.name = name;
		this.img = img;
	}
}

rhit.FbRoutesManager = class {
	constructor(uid) {
		this._uid = uid;
		this._documentSnapshots = [];
		this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_ROUTES);
		this._unsubscribe = null;
	}
	add(name, difficulty, location) {
		this._ref.add({
				[rhit.FB_KEY_NAME]: name,
				[rhit.FB_KEY_DIFFICULTY]: difficulty,
				[rhit.FB_KEY_LOCATION]: location,
				[rhit.FB_KEY_LAST_TOUCHED]: firebase.firestore.Timestamp.now()
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
		// if (this._uid) {
		// 	query = query.where(rhit.FB_KEY_AUTHOR, "==", this._uid);
		// }
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
		const route = new rhit.Route(docSnapshot.id, docSnapshot.get(rhit.FB_KEY_NAME), null);
		return route;
	}
}

rhit.DetailPageController = class {
	constructor() {
		document.querySelector("#submitEditRoute").addEventListener("click", (event) => {
			const name = document.querySelector("#inputName").value;
			const difficulty = document.querySelector("#inputDifficulty").value;
			const location = document.querySelector("#inputLocation").value;
			rhit.fbSingleRouteManager.update(name, difficulty, location);
		});

		document.querySelector("#submitAddRoute").addEventListener("click", (event) => {
			const inProgress = document.querySelector("#inProgress").checked;
			const startDate = document.querySelector("#inputStartDate").value;
			const notes = document.querySelector("#inputNotes").value;
			rhit.fbSingleRouteManager.addToMyRoutes(inProgress, startDate, notes);
		});

		$("#editRouteDialog").on("show.bs.modal", (event) => {
			document.querySelector("#inputName").value = rhit.fbSingleRouteManager.name;
			document.querySelector("#inputDifficulty").value = rhit.fbSingleRouteManager.difficulty;
			document.querySelector("#inputLocation").value = rhit.fbSingleRouteManager.location;
		});
		$("#editRouteDialog").on("shown.bs.modal", (event) => {
			document.querySelector("#inputName").focus();
		});

		$("#addRouteDialog").on("show.bs.modal", (event) => {
			document.querySelector("#inProgress").checked = true;
			let now = new Date();
			document.querySelector("#inputStartDate").value = (now.getMonth() + 1) + "/" + now.getDate() + "/" + now.getFullYear();
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
			window.location.href = `/stats.html?uid=${rhit.fbAuthManager.uid}`;
		});
		document.querySelector("#menuSignOut").addEventListener("click", (event) => {
			rhit.fbAuthManager.signOut();
		});

		rhit.fbSingleRouteManager.beginListening(this.updateView.bind(this));
	}

	updateView() {
		document.querySelector("#name").innerHTML = rhit.fbSingleRouteManager.name;
		document.querySelector("#difficulty").innerHTML = rhit.fbSingleRouteManager.difficulty;
		document.querySelector("#location").innerHTML = rhit.fbSingleRouteManager.location;
		document.querySelector("#privateDetails").hidden = true;

		// if (rhit.fbSinglePhotoManager.author == rhit.fbAuthManager.uid) {
		// 	document.querySelector("#menuEdit").style.display = "flex";
		// 	document.querySelector("#menuDelete").style.display = "flex";
		// }
	}
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

	update(name, difficulty, location) {
		this._ref.update({
				[rhit.FB_KEY_NAME]: name,
				[rhit.FB_KEY_DIFFICULTY]: difficulty,
				[rhit.FB_KEY_LOCATION]: location,
				[rhit.FB_KEY_LAST_TOUCHED]: firebase.firestore.Timestamp.now()
			})
			.then(() => {
				console.log("Document successfully updated!");
			})
			.catch((error) => {
				console.error("Error updating document: ", error);
			});
	}

	addToMyRoutes(inProgress, startDate, notes) {
		console.log(rhit.fbAuthManager.user);
		console.log(this._documentSnapshot);
		let newRoutes = rhit.fbAuthManager.user.get(rhit.FB_KEY_ROUTES);
		let newProgress = rhit.fbAuthManager.user.get(rhit.FB_KEY_IN_PROGRESS);
		let newNotes = rhit.fbAuthManager.user.get(rhit.FB_KEY_NOTES);
		let newStarts = rhit.fbAuthManager.user.get(rhit.FB_KEY_START_DATES);
		newRoutes.push(this._ref);
		newProgress.push(inProgress);
		newNotes.push(notes);
		newStarts.push(startDate);
		rhit.fbAuthManager.userRef.update({
			[rhit.FB_KEY_ROUTES]: newRoutes,
			[rhit.FB_KEY_IN_PROGRESS]: newProgress,
			[rhit.FB_KEY_NOTES]: newNotes,
			[rhit.FB_KEY_START_DATES]: newStarts
		});
	}

	delete() {
		return this._ref.delete();
	}

	get name() {
		return this._documentSnapshot.get(rhit.FB_KEY_NAME);
	}

	get location() {
		return this._documentSnapshot.get(rhit.FB_KEY_LOCATION);
	}

	get difficulty() {
		return this._documentSnapshot.get(rhit.FB_KEY_DIFFICULTY);
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