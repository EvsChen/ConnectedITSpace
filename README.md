# Connected IT Space

This system is designed for the Bosch Connected IT Space project, which aimed to monitor the number of visitors to IT Space and provides a vivid overview of the statistics. Also, people who want to visit one specific IT space can get the status of the space beforehead, in case the IT space is too crowded to accomodate more visitors.

## Installation
#### Prerequisites
NodeJS 8.9.0

Make sure NodeJS and npm (usually coming with Node) are installed. After cloning the repo into your folder, open a terminal (or cmd, powershell in Windows) and cd to the folder. Running `npm install`. After all the packages are installed, run `node server.js` in the terminal. Open a browser and type in the url shown in the terminal to get started.

## System design
The whole system is designed to be deployed on Bosch cloud. For the front end part, it uses AngularJS (1.4.x) as the main framework. For the backend, the server is running on NodeJS(Express) with MongoDB framework, which is provided as a service on Bosch cloud.

## System Structure 
#### `/app`
The app folder contains all the front end templates and controllers used in AngularJS.
#### `/controllers`
The controllers are used to handle backend logic. In `/api`, the controllers are routers for different type of data
#### `/dist`, `/src`
The folders are reserved for the implementation of automatic building tools, such as Gulp, Webpack. Currently they are useless.
#### `/services`
The services folder contains services to be used across the whole app. Most of them are dealing with direct database manipulation. As the name suggests, each of the service are related to different collections in the MongoDB.
#### `/public`
All public resources such as CSS files and scripts should be put in this folder. The files in this folder can be accessed, as described in `server.js`.

## Style guide
#### General guideline
In order to separate the layers of the system, several rules should be followed 
1. The manipulation of one specific collection should be put in **one** file. 
2. Any logic of the data should be put in the controller layer, this service layer only provides straight forward data manipulation, i.e. **add/delete/update/query**.
3. Cross reference between these services are disallowed.
4. The name of the service files should follow the pattern **datatype.service.js**, i.e. for modifying roomdata **roomdata.service.js**.
#### Coding style
The javascript files in this project follows Airbnb javascript guide. It's recommended to use **Eslint** for style lint. The rules are listed in `.eslintrc.js`.
