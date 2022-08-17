package main

import (
    "fmt"
    "strings"
    "regexp"
    "os"
    "bufio"
    "path/filepath"
    "io/fs"
)

func formatSnakeCase(tf string) string {
    re := regexp.MustCompile(`[\wa-zA-Z]+[+:]`)                         // find key
    ro := regexp.MustCompile(`:+([\s\S]*)$`)                            // find value
    ws := regexp.MustCompile(`^\s+`)                                    // find whitespace
    var v []string = ro.FindStringSubmatch(tf)                          // match for items
    km := re.FindStringSubmatch(tf)
    var matchFirstCap = regexp.MustCompile("(.)([A-Z][a-z]+)")
    var matchAllCap = regexp.MustCompile("([a-z0-9])([A-Z])")

    if len(km) != 0 {
      ks := km[0]                                                       // key is the 1st one
      s := matchFirstCap.ReplaceAllString(ks, "${1}_${2}")              // convert key to snake case
      s = matchAllCap.ReplaceAllString(s, "${1}_${2}")
      s = strings.ToLower(s)

      var p string
      sp := ws.FindStringSubmatch(tf)                                   // find beginning formatting
      i := strings.Join(sp, "")

      if (len(v[1]) == 0) {
        p = ""                                                          // set to empty if empty
      } else {
        var firstCharacter = regexp.MustCompile("[']")                  // check if value is quoted
        fc := firstCharacter.FindStringSubmatch(v[1])
        if (len(fc) == 0) {
          w := strings.TrimLeft(v[1], " ")                              // remove any leading spaces
          p = string(byte(32)) + string(byte(39)) + w + string(byte(39))// add corrected value with quotes
        } else {
          p = v[1]
        }
      }

      folder := "/Users/ashley/Documents/NGC896/COS/Repositories/ember-osf-web/lib/registries"
      filepath.WalkDir(folder, walk)

      l := [2]string{s, p}                                              // form converted line
      r := string(i + l[0] + l[1] + "\n")                               // preserve formatting
      return r                                                          // return line for write
      } else {
        return string(tf)
      }
}

func formatKebobCase(tf string) string { return "file kebob-case formatted" }

func formatPascalCase(tf string) string { return "file PascalCase formatted" }

func addSingleQuotes(tf string) string {
  return "string value hashed"
}

func returnHash(tf string) string { return "value in string hashed" }

func walk(s string, d fs.DirEntry, err error) error {
   // TODO determine entry point for component name
   c, err := regexp.Compile("navbar")

   kl, err := os.OpenFile("../resources/key_log.txt", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)

   if err != nil {
      return err
   }
   if ! d.IsDir() && c.MatchString(s) {
      kl.WriteString(s + "\n")

      if err != nil {
        panic(err)
      }
      defer kl.Close()
      println(s)
   }
   return nil
}

func main() {
    f, err := os.Open("../resources/en-us-language-map.txt")
    nf, err := os.Create("../resources/en-us_conversion_file.yml")
    os.Create("../resources/key_log.txt")                                 // create key log
    if err != nil {
      fmt.Println(err)
    }

    scanner := bufio.NewScanner(f)
    scanner.Split(bufio.ScanLines)
    for scanner.Scan() {
      var st = scanner.Text()
      var itr = formatSnakeCase(st)
      nf.Write([]byte(itr))
    }

    if err := scanner.Err(); err != nil {
      fmt.Println(err)
    }
    // fmt.Println(key)
    defer f.Close()

    // make a file with all the keys
}
