	// asu_NudgeKeyFrames.jsx
	// Copyright (c) 2007-2009 sundstedt.se (Anders Sundstedt). All rights reserved.
	// check it: http://www.sundstedt.se
	// 
	// Name: asu_NudgeKeyFrames
	// Version: 1.1
	// 
	// Description:
	// This script moves all keyframes to the nearest matching keyframe for the framerate of that comp
	// Note: It handles AnchorPoint, Position, Scale, Rotation and Opacity keyframes.  
	// Note: Existing keyframes are removed prior to creating the adjusted (nudged) keyframe
	// 
	// Usage: Just run this script on any open project (make sure you save project first just in case).
	// Script has been tested using Adobe After Effects CS3 and works for me but may still need improvements.
	
	// Originally requested by David Aughenbaugh
	// 
	// Legal stuff:
	// This script is provided "as is," without warranty of any kind, expressed
	// or implied. In no event shall the author be held liable for any damages 
	// arising in any way from the use of this script.
		
// 立即关闭宿主面板，避免残留空窗口（从 Window > Extensions 运行时）
try { if (this instanceof Window) { this.close(); } } catch (e) {}

function projectItem(name)
{
  var items = app.project.items;
  z = 1;
  while (z <= items.length) {
       if (items[z].name == name)
      {
       return app.project.item(z);
       break;
       }
   z++;
   }
} 

var items = app.project.items; 
var comps = new Array(); 

// Store comps in an array; starts as empty
for (var i = 1; i <= items.length; i++)
{
	if (items[i] instanceof CompItem) 
	{	comps[comps.length] = items[i];  }
}	

for (var k = 0; k < comps.length; k++)
{

	var my_comp = comps[k];
	layers = my_comp.layers;
	var fps = my_comp.frameRate;

	// loop over all layers of that comp (later this is a loop inside the comps loop
	for (var i = 1; i <= layers.length; i++) 
	{
		// for all keyframes of that layer
		for (var j = 1; j <= layers[i].position.numKeys; j++)
		{
			// myNearestKeyIndex = layers[i].position.nearestKeyIndex(0);
			var mykeyTime = layers[i].position.keyTime(j); // j is a keyframe nr
			
			// I want to set the time value of keyfram (j)
			nearestTime = Math.round(mykeyTime*fps)/fps; // round to nearest keyframe value;

			// Copy the position value (x,y,z) of keyframe(j)
			var posValueCopy = layers[i].position.keyValue(j);
			
			// Delete the keyframe 
			layers[i].position.removeKey(j);
						
			// Add a replacement key for removed key at correct position	
			layers[i].position.addKey(nearestTime);

			// Set the position value of keyframe k to the stored position value of deleted keyframe
			layers[i].position.setValueAtKey(j, posValueCopy);
			
		}
	}

	// loop over all layers for Scale
	for (var i = 1; i <= layers.length; i++) 
	{
		// for all keyframes of that layer
		for (var j = 1; j <= layers[i].scale.numKeys; j++)
		{
			// myNearestKeyIndex = layers[i].position.nearestKeyIndex(0);
			var mykeyTime = layers[i].scale.keyTime(j); // j is a keyframe nr
			
			// I want to set the time value of keyfram (j)
			nearestTime = Math.round(mykeyTime*fps)/fps; // round to nearest keyframe value;

			// Copy the position value (x,y,z) of keyframe(j)
			var scaleValueCopy = layers[i].scale.keyValue(j);
			
			// Delete the keyframe 
			layers[i].scale.removeKey(j);
						
			// Add a replacement key for removed key at correct position	
			layers[i].scale.addKey(nearestTime);

			// Set the position value of keyframe k to the stored position value of deleted keyframe
			layers[i].scale.setValueAtKey(j, scaleValueCopy);
			
		}
	}

	// loop over all layers for Rotation
	for (var i = 1; i <= layers.length; i++) 
	{
		// for all keyframes of that layer
		for (var j = 1; j <= layers[i].rotation.numKeys; j++)
		{
			// myNearestKeyIndex = layers[i].position.nearestKeyIndex(0);
			var mykeyTime = layers[i].rotation.keyTime(j); // j is a keyframe nr
			
			// I want to set the time value of keyfram (j)
			nearestTime = Math.round(mykeyTime*fps)/fps; // round to nearest keyframe value;

			// Copy the rotation value of keyframe(j)
			var rotValueCopy = layers[i].rotation.keyValue(j);
			
			// Delete the keyframe 
			layers[i].rotation.removeKey(j);
						
			// Add a replacement key for removed key at correct position	
			layers[i].rotation.addKey(nearestTime);

			// Set the position value of keyframe k to the stored position value of deleted keyframe
			layers[i].rotation.setValueAtKey(j, rotValueCopy);
			
		}
	}

	// loop over all layers for Opacity
	for (var i = 1; i <= layers.length; i++) 
	{
		// for all keyframes of that layer
		for (var j = 1; j <= layers[i].opacity.numKeys; j++)
		{
			// myNearestKeyIndex = layers[i].position.nearestKeyIndex(0);
			var mykeyTime = layers[i].opacity.keyTime(j); // j is a keyframe nr
			
			// I want to set the time value of keyfram (j)
			nearestTime = Math.round(mykeyTime*fps)/fps; // round to nearest keyframe value;

			// Copy the opacity value (x,y,z) of keyframe(j)
			var opacityValueCopy = layers[i].opacity.keyValue(j);
			
			// Delete the keyframe 
			layers[i].opacity.removeKey(j);
						
			// Add a replacement key for removed key at correct position	
			layers[i].opacity.addKey(nearestTime);

			// Set the position value of keyframe k to the stored position value of deleted keyframe
			layers[i].opacity.setValueAtKey(j, opacityValueCopy);
			
		}
	}

	// loop over all layers for Anchorpoint
	for (var i = 1; i <= layers.length; i++) 
	{
		// for all keyframes of that layer
		for (var j = 1; j <= layers[i].anchorPoint.numKeys; j++)
		{
			// myNearestKeyIndex = layers[i].position.nearestKeyIndex(0);
			var mykeyTime = layers[i].anchorPoint.keyTime(j); // j is a keyframe nr
			
			// I want to set the time value of keyfram (j)
			nearestTime = Math.round(mykeyTime*fps)/fps; // round to nearest keyframe value;

			// Copy the anchorpoint value (x,y,z) of keyframe(j)
			var anchorValueCopy = layers[i].anchorPoint.keyValue(j);
			
			// Delete the keyframe 
			layers[i].anchorPoint.removeKey(j);
						
			// Add a replacement key for removed key at correct position	
			layers[i].anchorPoint.addKey(nearestTime);

			// Set the position value of keyframe k to the stored position value of deleted keyframe
			layers[i].anchorPoint.setValueAtKey(j, anchorValueCopy);
			
		}
	}

}

alert("已经修正！\n所有合成中的 Transform 关键帧已吸附到最近整帧。");