import {select as d3select, event as d3event} from 'd3-selection'
import * as client from './client'

// allowed schema names
const schemaNames=[
	'heatmapJSON',
	'piebarJSON',
	'survivalJSON',
	'discoJSON',
	'riverJSON'
];

// mapping of mutation type name to numeric index,
// as specified in client.js filetypeselect()
const typeIndex={
	snvindel: 0,
	si: 0,
	sv: 1,
	fusion: 2,
	itd: 3,
	deletion: 4,
	truncation: 5,
	cnv: 6
};

let urlProjectLoaded = false;

/*
	Easily upload multiple data files
*/
export class ProjectHandler {
	/*
		Create a handler for multiple uploaded or fetched
		files in a project

		bt = {
			flag: closured flag inside bulkui.bulkui,
			bulkin: bulkui.bulkin,
			content2flag: bulkui.content2flag,
			flag2tp: closured flat2tp,
			filediv: (optional) d3-wrapped container for file-input
		}
	*/
	constructor(bt) {
		this.bt=bt;
		this.err=this.errHandler();

		// autoload a project if specified via URL parameter
		// happens only once, right after the first instance of
		// projectHandler is created
		if (!urlProjectLoaded) {
			const params=getParams();
			if (params.project) {
				this.getData(params.project);
				urlProjectLoaded = true;
			}
		}

		if (bt.filediv) {
			this.projectByInput(bt.filediv)
		}
	}

	/*
		Process data files sequentially for rendering
		into a TP div

		data = {
			schemas: object {
				heatmapJSON (optional),
				piebarJSON (optional),
				survivalJSON (optional)
			},
			files: [] array of {
				name: string
				typeL one of the typeIndex values 
				content: string
			}
		}
	*/

	processData(data) {
		const file=data.files.pop()
		const i=data.expectedFileNames.indexOf(file.name);
		if (i==-1) {
			if (data.files.length) setTimeout(()=>{
				this.processData(data);
			},1);
			return; // ignore files that are not listed in the reference file
		}
		data.expectedFileNames.splice(i,1);
		this.cohort = {
			name: 'project',
			genome: this.bt.genomes[this.bt.gselect.options[this.bt.gselect.selectedIndex].innerHTML]
		}

		if (!this.flag) {
			this.flag=this.bt.init_bulk_flag(this.cohort.genome);
		}

		const error=this.bt.content2flag(
			file.content,
			file.type,
			this.flag
		);

		if (error) {
			this.err(error);
			this.processData(data);
		}
		else if (!data.files.length) {
			if (data.expectedFileNames.length) {
				this.err('These referenced files were not found: "'+ data.expectedFileNames.join('", "') +'".');
			}
			this.bt.flag2tp(this.flag,{name:'project'},Object.assign(this.cohort,data.schema),this.ds);
			return;
		}
		else {
			//if (this.cohort.dsset) console.log(Object.keys(this.cohort.dsset))
			if (!this.ds) {
				for(const k in this.cohort.dsset) {
					this.ds=this.cohort.dsset[k];
					break
				} 
			}
			
			// flag2thisds tells the data in flag will be appended to the given ds
			const error1=this.bt.bulkin({
				flag: this.flag,
				cohort: this.cohort,
				flag2thisds: this.ds,
				filename: 'project'
			},()=>{
				this.processData(data);
			})
			if(error1) {
				this.err('Error with '+file.name+': '+error1)
				return
			}
			if(this.flag.good===0) {
				this.err(file.name+': no data loaded')
				return
			}
		}
	}

	getData(project){
		const [projectname,_refname]=project.split('/');
		const refname = _refname && _refname.trim() ? _refname.trim() : 'ref.txt';

		this.gettext('/data/projects/'+projectname+'/'+refname,(text)=>{
			const fileNameToType={};
			const nameToSchemaType={};
			const data={schema:{},files:[],expectedFileNames:[]};
			let schemaFileName='';
			let numProcessedFiles=0;
			let numFiles=0

			text.trim().split('\n').forEach(line=>{
				const [type,filename]=line.trim().split('\t')
				if (schemaNames.includes(type)) {
					nameToSchemaType[filename]=type;
					numFiles+=1;
				}
				else if (!typeIndex[type] && typeIndex[type]!==0) {
					this.err('Unrecognized type '+ type +' for file '+filename+' in reference.txt.');
				}
				else {
					fileNameToType[filename]=typeIndex[type];
					numFiles+=1;
				}
			});

			data.expectedFileNames=Object.keys(fileNameToType);
			const tracker=this.getTracker(numFiles,()=>this.processData(data));

			Object.keys(nameToSchemaType).forEach(filename=>{
				this.getjson('/data/projects/'+projectname+'/'+filename,(json)=>{
					data.schema[nameToSchemaType[filename]]=json;
					tracker();
				})
			});

			Object.keys(fileNameToType).forEach(filename=>{
				this.gettext('/data/projects/'+projectname+'/'+filename,(text)=>{
					data.files.push({
						name:filename,
						type:fileNameToType[filename],
						content: text
					});
					tracker();
				})
			})
		})
	}

	gettext(url,callback) {
		fetch(url)
   			.then(response=>{
   				if (response.ok) return response.text()
   				else this.err('File request error: '+ url)
   			})
    		.then(callback)
    		.catch(error=>this.err('File request error: '+url+' '+ error))
	}

	getjson(url,callback) {
    	fetch(url)
   			.then(response=>{
   				if (response.ok) return response.json()
   				else this.err('Network error for '+ url)
   			})
    		.then(callback)
    		.catch(error=>this.err('file request error: '+url+' '+ error))
	}

	getTracker(numFiles,callback) {
		let numProcessedFiles=0
		
		return function tracker() {
			numProcessedFiles+=1;
			if (numProcessedFiles==numFiles) {
				callback();
			}
		}
	}

	projectByInput(filediv) {
		this.tp=null;

		const advancedDiv=filediv.append('div');
		advancedDiv.append('span').html('Project: reference &nbsp;');

		this.refNameInput=advancedDiv.append('input')
				.attr('type','text')
				.property('value','ref.txt')
				.style('margin-right','20px')
				.style('padding-left','7px');

		const buttlabel=advancedDiv.append('label')
				.attr('for','sja-pp-bulk-ui-project-btn')
				.attr('class','sja_btn')
				.style('padding','3px 5px')
				.html('Choose folder');

		const butt=advancedDiv.append('input')
				.attr('type','file')
				.attr('id','sja-pp-bulk-ui-project-btn')
				.property('multiple',true)
				.property('webkitdirectory',true)
				.property('directory',true)
				.style('width','0')
				.on('change',()=>this.readFiles());

		advancedDiv.append('div')
			.style('margin','10px 10px 10px 0')
			.html(`<a href="https://docs.google.com/document/d/1wlfGzyhxFYtWu9Fyf3FK7pgvS3rVb9_vrfYUBUOUrw4/edit?usp=sharing" target="new">Project user guide</a> | 
			<a href='https://pecan.stjude.org/static/target-tall-project/ref.txt' target=_blank>Example project reference file</a>`)

		advancedDiv.append('div')
			.style('margin','20px')
			.style('width','100%')
			.html('-- OR --');
	}

	/* to be used as a file input (FileList) handler */
	readFiles() {
		const self=this;
		const refFileName=self.refNameInput.property('value');
		const files=Array.from(d3event.target.files);
		const ref=files.filter(f=>f.name==refFileName)[0];

		if (!ref) {
			self.err("Missing reference file='"+refFileName+"'.");
			return;
		}

		const fileNameToType={};
		const nameToSchemaType={};
		const data={schema:{},files:[],expectedFileNames:[]};
		const reader=new FileReader();
		let schemaFileName='';
		let numProcessedFiles=0;

		reader.onload=(event)=>{
			// process reference file
			event.target.result.trim().split('\n').forEach(line=>{
				const [type,filename]=line.trim().split('\t');
				if (schemaNames.includes(type)) {
					nameToSchemaType[filename]=type;
				}
				else if (!typeIndex[type] && typeIndex[type]!==0) {
					self.err('Unrecognized type '+ type +' for file '+filename+' in reference.txt.');
				}
				else {
					fileNameToType[filename]=typeIndex[type];
				}
			});

			// track the expected files to processed by filename
			data.expectedFileNames=Object.keys(fileNameToType);
			
			// get schemas next
			const schemaFiles=files.filter(file=>file.name in nameToSchemaType);
			let numProcessedSchemas=0
			if (!schemaFiles.length) {
				files.forEach(processFile);
			}
			else {
				schemaFiles.forEach(file=>{
					const reader=new FileReader();
					reader.onload=(event)=>{
						const schema=JSON.parse(event.target.result);
						numProcessedSchemas+=1;
						if (!schema) {
							self.err('Unable to parse schema file="'+file.name+'".');
						}
						else {
							data.schema[nameToSchemaType[file.name]]=schema;
						}
						if (numProcessedSchemas==schemaFiles.length) {
							files.forEach(processFile)
						}
					}
					reader.onerror=()=>{
						self.err('Error reading schema.txt.');
					}
					reader.readAsText(file,'utf8');
				});
			}

			function processFile(file){
				if (!data.expectedFileNames.includes(file.name)) {
					numProcessedFiles+=1;
					return;
				}
				if(!file) {
					self.err('Error reading file.');
					numProcessedFiles+=1;
					return;
				}
				if(file.size==0) {
					self.err('Wrong file: '+file.name);
					numProcessedFiles+=1;
					return;
				}
				if (!fileNameToType[file.name] && fileNameToType[file.name]!==0 && file.name!=schemaFileName) {
					self.err('Missing or invalid type assigned to file '+ file.name +'.');
					numProcessedFiles+=1;
					return;
				}
				const reader=new FileReader();
			
				reader.onload=(event)=>{
					numProcessedFiles+=1;
					data.files.push({
						name:file.name,
						type:fileNameToType[file.name],
						content: event.target.result
					});
					if (numProcessedFiles==files.length) {
						self.processData(data);
					}
				}
				reader.onerror=()=>{
					numProcessedFiles+=1;
					self.err('Error reading file '+file.name);
					if (numProcessedFiles==files.length) {
						self.processData(data);
					}
				}
				reader.readAsText(file,'utf8');
			};
		}
		reader.onerror=()=>{
			self.err('Error reading reference.txt.');
		}
		reader.readAsText(ref,'utf8');
	}

	// function to track and display accumulated error messages
	errHandler() {
		const errdiv=d3select('body').append('div')//.style('display','none');
		let mssg=''
		return function (m) {
			if (!m) return; //console.log(m)
			//mssg+=m+'<br/>\n'
			client.sayerror(errdiv,m);//mssg);
		}
	}
}


function getParams() {
	const params={}
	window.location.search.substr(1).split("&").forEach(kv=>{
		const [key,value]=kv.split("=")
		params[key]=value
	})
	return params 
}
