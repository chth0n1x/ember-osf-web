package main

import (
    "fmt"
    "strings"
    "regexp"
    "os"
    "bufio"
)

func formatSnakeCase(tf string) string {

    re := regexp.MustCompile(`([a-zA-Z-_]+[a-zA-Z-_]+)(:+)`)  // find key
    var v []string = re.Split(tf, -1)                         // find value
    var matchFirstCap = regexp.MustCompile("(.)([A-Z][a-z]+)")
    var matchAllCap   = regexp.MustCompile("([a-z0-9])([A-Z])")

    km := re.FindStringSubmatch(tf)                           // find match in line passed
    if len(km) != 0 {
      ks := km[0]                                             // it's going to be the 1st one
      s := matchFirstCap.ReplaceAllString(ks, "${1}_${2}")
      s  = matchAllCap.ReplaceAllString(s, "${1}_${2}")
      s = strings.ToLower(s)
      fmt.Println("value is", v)
      var p string
      if (len(v[1]) == 0) {
        p = "\n"
        fmt.Println("value empty", len(v[1]))
      } else {
        fmt.Println("value nonempty", len(v[1]))
        p = v[1]
      }
                                               // set value
      l := [2]string{s, p}
                                                              // if predicate is nil, add new line
      // fmt.Println(l)
      r := string(l[0] + l[1])
      fmt.Println(r)
      return r
      } else {
        return string(tf)
      }
}

func main() {
    f, err := os.Open("../resources/en-us-language-map.txt")
    nf, err := os.Create("../resources/en-us_conversion_file.yml")

    if err != nil {
      fmt.Println(err)
    }

    scanner := bufio.NewScanner(f)
    scanner.Split(bufio.ScanLines)
    for scanner.Scan() {
      var st = scanner.Text()
      var itr = formatSnakeCase(st)
      nf.Write([]byte(itr))
      nf.Write([]byte(" "))
      nf.Write([]byte("\n"))
    }

    if err := scanner.Err(); err != nil {
      fmt.Println(err)
    }
    defer f.Close()
}
