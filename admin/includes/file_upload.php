<?php

require_once("smart_resize_image.php");


ini_set('post_max_size', '512M');
ini_set('upload_max_filesize', '512M');

function upload_file($varname){
   $files=array();
   if(is_array($_FILES[$varname]["name"])){
        for($i=0;$i<count($_FILES[$varname]["name"]);++$i){
            $files[]= array(
                            'name'     => $_FILES[$varname]['name'][$i],
                            'error'    => $_FILES[$varname]['error'][$i],
                            'type'     => $_FILES[$varname]['type'][$i],
                            'size'     => $_FILES[$varname]['size'][$i],
                            'tmp_name' => $_FILES[$varname]['tmp_name'][$i],
                            );
        }
   } 


foreach ($files as $filename) {

$allowedExts = array("jpg", "jpeg", "gif", "png", "pdf", "doc", "docx", "avif", "mp4",  "JPG", "PNG", "webp");

$random = mt_rand(100000, 999999);
$nombre = stripAccents($filename["name"]);
$nombre = strtolower($nombre);
$nombre = str_replace(' ', '_', $nombre);
$nombre = explode('.', $filename["name"]);
$extension = end( $nombre); 


if ((($filename["type"] == "image/gif")
|| ($filename["type"] == "image/jpeg")
|| ($filename["type"] == "video/mp4")
|| ($filename["type"] == "image/png")
|| ($filename["type"] == "image/avif")
|| ($filename["type"] == "image/webp")
|| ($filename["type"] == "image/jpg"))
/* && ($filename["size"] < 25000000) */
&& ($filename["size"] < 75000000)
&& in_array($extension, $allowedExts))
  {

   foreach ($files as $file) {

  if ($file["error"] > 0)
    {
    echo "Return Code: " . $file["error"] . "<br />";
    }
  else
    {

      $archivo = $file["name"];      
      list($nombre, $tipo) = explode(".", $archivo); 

      $nombre = stripAccents($nombre);
      $nombre = strtolower($nombre);
      $nombre = str_replace(' ', '_', $nombre);  

    if (file_exists("". $_SERVER['DOCUMENT_ROOT'] . "/uploads/" .$nombre.".".$tipo))
      {

      $archivo = $file["name"];      
      list($nombre, $tipo) = explode(".", $archivo);  

      $nombre = stripAccents($nombre);
      $nombre = strtolower($nombre);
      $nombre = str_replace(' ', '_', $nombre);  

      move_uploaded_file($file["tmp_name"],
      "". $_SERVER['DOCUMENT_ROOT'] . "/uploads/" . $nombre ."_". $random .".".$tipo);

      $ruta= "uploads/". $nombre ."_". $random .".".$tipo;

      $fileruta= "". $_SERVER['DOCUMENT_ROOT'] . "/uploads/". $nombre ."_". $random .".".$tipo;
      $imagen_thumb = "". $_SERVER['DOCUMENT_ROOT'] . "/uploads/". $nombre ."_". $random ."_perfil.".$tipo;      

      if ( $tipo !="webp" ) 
      
      {
        smart_resize_image($fileruta , 400 , 0 , true , $imagen_thumb , false , false ,100 ); 
      }
   

      return $ruta;

      }
    else
      {

      $archivo = $file["name"];  
      list($nombre, $tipo) = explode(".", $archivo); 

      $nombre = stripAccents($nombre);
      $nombre = strtolower($nombre);
      $nombre = str_replace(' ', '_', $nombre);   
        
      move_uploaded_file($file["tmp_name"],
      "". $_SERVER['DOCUMENT_ROOT'] . "/uploads/" . $nombre .".".$tipo);

      $ruta= "uploads/". $nombre .".".$tipo;

      $fileruta= "". $_SERVER['DOCUMENT_ROOT'] . "/uploads/". $nombre.".".$tipo;
      $imagen_thumb = "". $_SERVER['DOCUMENT_ROOT'] . "/uploads/". $nombre ."_perfil.".$tipo;  
      
            

      if ( $tipo !="webp" ) 
      
      {
        smart_resize_image($fileruta , 400 , 0 , true , $imagen_thumb , false , false ,100 ); 
      }
     

      return $ruta;

      }
     }
    }
  }


  
if ((($filename["type"] == "text/pdf")
|| ($filename["type"] == "application/pdf")
|| ($filename["type"] == "application/msword")
|| ($filename["type"] == "application/x-view-source"))
&& ($filename["size"] < 75000000)
&& in_array($extension, $allowedExts))
  {
    
     foreach ($files as $file) {

  if ($file["error"] > 0)
    {
    echo "Return Code: " . $file["error"] . "<br />";
    }
  else
    {

      $archivo = $file["name"];      
      list($nombre, $tipo) = explode(".", $archivo); 

      $nombre = stripAccents($nombre);
      $nombre = strtolower($nombre);
      $nombre = str_replace(' ', '_', $nombre);  

    if (file_exists("". $_SERVER['DOCUMENT_ROOT'] . "/uploads/" .$nombre.".".$tipo))
      {

      $archivo = $file["name"];      
      list($nombre, $tipo) = explode(".", $archivo);  

      $nombre = stripAccents($nombre);
      $nombre = strtolower($nombre);
      $nombre = str_replace(' ', '_', $nombre);  

      move_uploaded_file($file["tmp_name"],
      "". $_SERVER['DOCUMENT_ROOT'] . "/uploads/" . $nombre ."_". $random .".".$tipo);

      $ruta= "uploads/". $nombre ."_". $random .".".$tipo;

      $fileruta= "". $_SERVER['DOCUMENT_ROOT'] . "/uploads/". $nombre ."_". $random .".".$tipo;


      return $ruta;




      }
    else
      {

      $archivo = $file["name"];  
      list($nombre, $tipo) = explode(".", $archivo); 

      $nombre = stripAccents($nombre);
      $nombre = strtolower($nombre);
      $nombre = str_replace(' ', '_', $nombre);   
        
      move_uploaded_file($file["tmp_name"],
      "". $_SERVER['DOCUMENT_ROOT'] . "/uploads/" . $nombre .".".$tipo);

      $ruta= "uploads/". $nombre .".".$tipo;

      $fileruta= "". $_SERVER['DOCUMENT_ROOT'] . "/uploads/". $nombre.".".$tipo;

      return $ruta;

      }
     }
    }
    
    
    
  }
}
}


?>